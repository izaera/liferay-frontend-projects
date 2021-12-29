/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {FilePath, PkgJson} from '@liferay/js-toolkit-core';
import fs from 'fs';
import bundler2Project from 'liferay-npm-build-tools-common/lib/project';
import os from 'os';
import path from 'path';

export interface Configuration {
	build?: {
		type: 'bundler2' | 'customElement';
		options?: ConfigurationOptions;
	};
	deploy?: {
		liferayDir?: string;
	};
}

export type ConfigurationOptions =
	| Bundler2ConfigurationOptions
	| CustomElementConfigurationOptions;

export interface Bundler2ConfigurationOptions {}

export interface CustomElementConfigurationOptions {
	externals: {[bareIdentifier: string]: string} | string[];
}

export type BuildType = 'bundler2' | 'customElement';

export type BuildOptions = Bundler2BuildOptions | CustomElementBuildOptions;

export interface Bundler2BuildOptions {}

export interface CustomElementBuildOptions {
	externals: {[bareIdentifier: string]: string};
}

// TODO: don't use bundler2 project class

export default class Project {
	constructor(projectPath: string) {
		this.dir = new FilePath(projectPath).resolve();

		this._configuration = this._loadConfiguration();

		// TODO: should we check bundler2Project for srcDir ?

		this.srcDir = this.dir.join('src');

		if (this.buildType === 'bundler2') {
			this.buildDir = new FilePath(
				bundler2Project.buildDir.asNative
			).resolve();
			this.distDir = new FilePath(
				bundler2Project.jar.outputDir.asNative
			).resolve();
			this.distFile = this.distDir.join(
				bundler2Project.jar.outputFilename
			);
		}
		else if (this.buildType === 'customElement') {
			this.buildDir = this.dir.join('build');
			this.distDir = null;
			this.distFile = null;
		}
	}

	get buildType(): BuildType {
		if (!this._buildType) {
			this._buildType = this._configuration.build?.type || 'bundler2';
		}

		return this._buildType;
	}

	get deployDir(): FilePath | null {
		if (this._deployDir === undefined) {
			this._deployDir = this._configuration.deploy
				? new FilePath(this._configuration.deploy as string).resolve()
				: null;
		}

		return this._deployDir;
	}

	get buildOptions(): BuildOptions | null {
		if (this._buildOptions === undefined) {
			let options = this._configuration.build?.options;

			if (!options) {
				this._buildOptions = null;
			}
			else if (this.buildType === 'customElement') {
				this._buildOptions = this._normalizeCustomElementBuildOptions(
					options as CustomElementConfigurationOptions
				);
			}
		}

		return this._buildOptions;
	}

	get pkgJson(): PkgJson {
		if (!this._pkgJson) {
			this._pkgJson = require(this.dir.join('package.json').asNative);
		}

		return this._pkgJson;
	}

	storeDeployDir(deployDir: FilePath): void {
		deployDir = deployDir.resolve();

		this._deployDir = deployDir;
		this._configuration.deploy.liferayDir = deployDir.asNative;

		this._saveConfiguration(this.dir.join('.liferay.json'));
	}

	private _loadConfiguration(): Configuration {
		let configuration = {};

		[
			path.join(os.homedir(), '.liferay.json'),
			this.dir.join('.liferay.json').asNative,
			this.dir.join('liferay.json').asNative,
		].forEach((liferayJsonPath) => {
			try {
				configuration = {
					...configuration,
					...JSON.parse(fs.readFileSync(liferayJsonPath, 'utf8')),
				};
			}
			catch (error) {
				if (error.code !== 'ENOENT') {
					throw error;
				}
			}
		});

		// Validate and normalize according to schema completely

		configuration['build'] = configuration['build'] || {};

		switch (configuration['build']['type']) {
			case '':
			case 'bundler2':
			case undefined:
				configuration['build']['type'] = 'bundler2';
				break;

			case 'customElement':
				break;

			default:
				throw new Error(
					`Invalid build type ${configuration['build']['type']} found in configuration`
				);
		}

		return configuration as Configuration;
	}

	private _normalizeCustomElementBuildOptions(
		options: CustomElementConfigurationOptions
	): CustomElementBuildOptions {
		const buildOptions: CustomElementBuildOptions = {externals: {}};

		if (Array.isArray(options['externals'])) {
			buildOptions.externals = options.externals.reduce(
				(map, bareIdentifier) => {
					map[bareIdentifier] = bareIdentifier;
					return map;
				},
				{}
			);
		}

		return buildOptions;
	}

	private _saveConfiguration(file: FilePath): void {
		fs.writeFileSync(
			file.asNative,
			JSON.stringify(this._configuration, null, '\t'),
			'utf8'
		);
	}

	readonly dir: FilePath;
	readonly srcDir: FilePath;
	readonly buildDir: FilePath;
	readonly distDir: FilePath | null;
	readonly distFile: FilePath | null;

	private _buildOptions: BuildOptions;
	private _buildType: BuildType;
	private _configuration: Configuration;
	private _deployDir: FilePath | null;
	private _pkgJson: PkgJson;
}
