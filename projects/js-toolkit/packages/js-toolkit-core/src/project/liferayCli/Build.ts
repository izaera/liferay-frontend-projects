/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import fs from 'fs';

import FilePath from '../../file/FilePath';
import LiferayJson, {
	AngularCliBuildConfig,
	BuildConfig,
	Bundler2BuildConfig,
	CustomElementBuildConfig,
} from '../../schema/LiferayJson';
import Project from './Project';

type BuildType = '@angular/cli' | 'bundler2' | 'customElement';

type BuildOptions =
	| AngularCliBuildOptions
	| Bundler2BuildOptions
	| CustomElementBuildOptions;

export type AngularCliBuildOptions = {
	htmlElementName: string | null;
};

export type Bundler2BuildOptions = {};

export interface CustomElementBuildOptions {
	externals: {[bareIdentifier: string]: string};
	htmlElementName: string | null;
}

export default class Build {
	readonly dir: FilePath;
	readonly type: BuildType;
	readonly options: BuildOptions;

	constructor(project: Project, liferayJson: LiferayJson) {
		const config: BuildConfig = liferayJson.build?.options || {};

		liferayJson.build = liferayJson.build || {};
		liferayJson.build.type =
			liferayJson.build.type || guessBuildType(project);

		switch (liferayJson.build.type) {
			case '@angular/cli':
				this.type = '@angular/cli';

				// TODO: get output path from angular.json

				this.dir = project.dir.join('dist');
				this.options = this._toAngularCliBuildOptions(
					project,
					config as AngularCliBuildConfig
				);
				break;

			case 'customElement':
				this.type = 'customElement';
				this.dir = project.dir.join('build');
				this.options = this._toCustomElementBuildOptions(
					project,
					config as CustomElementBuildConfig
				);
				break;

			case 'bundler2': {
				const {
					default: bundler2Project,
					/* eslint-disable-next-line @typescript-eslint/no-var-requires */
				} = require('liferay-npm-build-tools-common/lib/project');

				this.type = 'bundler2';
				this.dir = new FilePath(
					bundler2Project.buildDir.asNative
				).resolve();
				this.options = this._toBundler2BuildOptions(
					config as Bundler2BuildConfig
				);
				break;
			}

			default:
				throw new Error(
					`Unknown project build type type: ${liferayJson.build.type}`
				);
		}
	}

	private _toAngularCliBuildOptions(
		project: Project,
		config: AngularCliBuildConfig
	): AngularCliBuildOptions {
		const options: AngularCliBuildOptions = {
			htmlElementName: config.htmlElementName,
		};

		// Infer htmlElementName from source code if needed

		if (!options.htmlElementName) {
			options.htmlElementName = findHtmlElementName(
				project.mainModuleFile
			);
		}

		return options;
	}

	private _toCustomElementBuildOptions(
		project: Project,
		config: CustomElementBuildConfig
	): CustomElementBuildOptions {

		// Turn arrays coming from liferay.json into objects

		if (Array.isArray(config['externals'])) {
			config.externals = config.externals.reduce(
				(map, bareIdentifier) => {
					map[bareIdentifier] = bareIdentifier;

					return map;
				},
				{}
			);
		}

		const options: CustomElementBuildOptions = {
			externals: config.externals || {},
			htmlElementName: config.htmlElementName,
		};

		// Remove externals mapped to null

		options.externals = Object.entries(options.externals).reduce(
			(externals, entry) => {
				if (entry[1] !== null) {
					externals[entry[0]] = entry[1];
				}

				return externals;
			},
			{}
		);

		// Infer htmlElementName from source code if needed

		if (!options.htmlElementName) {
			options.htmlElementName = findHtmlElementName(
				project.mainModuleFile
			);
		}

		return options;
	}

	private _toBundler2BuildOptions(
		_config: Bundler2BuildConfig
	): Bundler2BuildOptions {
		return {};
	}
}

function findHtmlElementName(file: FilePath): string | undefined {
	const source = fs.readFileSync(file.asNative, 'utf8');
	const regex = /customElements.define\(([^(]*)\)/;

	const match = regex.exec(source);

	if (!match) {
		return undefined;
	}

	const args = match[1].trim();

	if (!["'", '"'].includes(args[0])) {
		return undefined;
	}

	const quote = args[0];

	const i = args.indexOf(quote, 1);

	if (i < 0) {
		return undefined;
	}

	return args.substring(1, i);
}

function guessBuildType(project: Project): BuildType {
	const {pkgJson} = project;

	if (
		pkgJson.devDependencies &&
		pkgJson.devDependencies['@angular-devkit/build-angular']
	) {
		return '@angular/cli';
	}

	return 'bundler2';
}
