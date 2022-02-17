/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {
	CustomElementBuildOptions,
	Project,
	RemoteAppManifestJson,
} from '@liferay/js-toolkit-core';

import abort from '../util/abort';
import findScssFiles from './findScssFiles';

// TODO: move this out of util into consumer file as it is not generic

export default function createManifest(project: Project): string {
	const options = project.build.options as CustomElementBuildOptions;
	const {htmlElementName} = options;

	if (!htmlElementName) {
		abort(
			`
Custom element name is not configured and cannot be inferred from the source code.

Please configure it using {build.options.htmlElementName} in the {liferay.json} file.`
		);
	}

	const manifest: RemoteAppManifestJson = {
		cssURLs: findScssFiles(project).map((file) =>
			project.assetsDir
				.relative(file)
				.toDotRelative()
				.asPosix.replace(/\.scss$/i, '.css')
		),
		htmlElementName,
		type: 'customElement',
		urls: [
			project.srcDir.relative(project.mainModuleFile).toDotRelative()
				.asPosix,
		],
		useESM: true,
	};

	return JSON.stringify(manifest, null, '\t');
}
