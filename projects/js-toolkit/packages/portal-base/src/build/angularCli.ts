/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

/* eslint-disable @liferay/no-dynamic-require */

import {
	AngularCliBuildOptions,
	Project,
	RemoteAppManifestJson,
	format,
} from '@liferay/js-toolkit-core';
import fs from 'fs';

import abort from '../util/abort';

const {info, print, text, warn} = format;

interface StatsJson {
	assets: StatsJsonAsset[];
}

interface StatsJsonAsset {
	name: string;
}

export default async function angularCli(project: Project): Promise<void> {
	checkConfiguration(project);

	createManifest(project);
}

function checkConfiguration(project: Project): void {
	if (!fs.existsSync(project.build.dir.join('stats.json').asNative)) {
		print('');
		print(
			warn`
There's no {stats.json} file in directory {${
				project.dir.relative(project.build.dir).asNative
			}}`
		);

		print('');
		print(text`
This is usually due to not having the {statsJson} option set to {true} in your
project's build target options.

See the documentation for Angular's {browser} Builder options at:

https://angular.io/guide/workspace-config#project-tool-configuration-options

Or run {liferay adapt} on this project again to make sure everything is
configured correctly.`);

		abort();
	}
}

function createManifest(project: Project): void {
	const options = project.build.options as AngularCliBuildOptions;

	const {htmlElementName} = options;

	if (!htmlElementName) {
		abort(
			`
Custom element name is not configured and cannot be inferred from the source code.

Please configure it using {build.options.htmlElementName} in the {liferay.json} file.`
		);
	}

	print(info`Generating {manifest.json}...`);

	const statsJson: StatsJson = JSON.parse(
		fs.readFileSync(project.build.dir.join('stats.json').asNative, 'utf8')
	);

	const {assets} = statsJson;

	const cssAssets = assets.filter((asset) =>
		asset.name.toLowerCase().endsWith('.css')
	);

	const jsAssets = assets.filter((asset) =>
		asset.name.toLowerCase().endsWith('.js')
	);

	const manifest: RemoteAppManifestJson = {
		cssURLs: cssAssets.map((asset) => `./${asset.name}`),
		htmlElementName,
		type: 'customElement',
		urls: jsAssets.map((asset) => `./${asset.name}`),
		useESM: true,
	};

	fs.writeFileSync(
		project.build.dir.join('manifest.json').asNative,
		JSON.stringify(manifest, null, '\t'),
		'utf8'
	);
}
