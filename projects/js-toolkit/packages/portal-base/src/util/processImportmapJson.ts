/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {FilePath, format} from '@liferay/js-toolkit-core';
import fs from 'fs';

import generateCjsEjsBridge from './generateCjsEsmBridge';

const {info, print} = format;

export interface ImportmapJson {
	[bareIdentifier: string]: string;
}

export default async function processImportmapJson(
	prjDir: FilePath,
	buildDir: FilePath,
	defaultImportmapJson: ImportmapJson = {}
): Promise<void> {
	let json: string;

	try {
		json = fs.readFileSync(prjDir.join('importmap.json').asNative, 'utf8');
	}
	catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}

		json = '{}';
	}

	const importmap: ImportmapJson = {
		...defaultImportmapJson,
		...JSON.parse(json),
	};

	print(info`Processing import map...`);

	let outImportMap: ImportmapJson = {};

	for await (const [bareIdentifier, uri] of Object.entries(importmap)) {
		if (uri.startsWith('cjs')) {
			const cjsFile = prjDir.join(uri.replace(/^cjs:/, ''));
			const esmFile = buildDir.join(
				'__liferay__',
				'cjs2esm',
				`${bareIdentifier}.js`
			);

			await generateCjsEjsBridge(bareIdentifier, cjsFile, esmFile);

			outImportMap[bareIdentifier] = `./${
				buildDir.relative(esmFile).asPosix
			}`;
		}
		else {
			outImportMap[bareIdentifier] = uri;
		}
	}

	fs.writeFileSync(
		buildDir.join('importmap.json').asNative,
		JSON.stringify(outImportMap, null, 2),
		'utf8'
	);
}
