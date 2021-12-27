/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {FilePath, format} from '@liferay/js-toolkit-core';
import fs from 'fs';
import resolve from 'resolve';

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
		let processedUri: string = uri;

		if (uri.startsWith('cjs')) {
			processedUri = await processCjs(
				prjDir,
				buildDir,
				bareIdentifier,
				uri.substring(4)
			);
		}
		else if (uri.startsWith('webpack')) {
			processedUri = await processWebpack(
				prjDir,
				buildDir,
				bareIdentifier,
				uri.substring(8)
			);
		}

		outImportMap[bareIdentifier] = processedUri;
	}

	fs.writeFileSync(
		buildDir.join('importmap.json').asNative,
		JSON.stringify(outImportMap, null, 2),
		'utf8'
	);
}

async function processCjs(
	prjDir: FilePath,
	buildDir: FilePath,
	bareIdentifier: string,
	uriPath: string
): Promise<string> {
	const cjsFile = prjDir.join(uriPath);
	const esmFile = buildDir.join(
		'__liferay__',
		'cjs2esm',
		`${bareIdentifier}.js`
	);

	await generateCjsEjsBridge(bareIdentifier, cjsFile, esmFile);

	return `./${buildDir.relative(esmFile).asPosix}`;
}

async function processWebpack(
	prjDir: FilePath,
	buildDir: FilePath,
	bareIdentifier: string,
	uriPath: string
): Promise<string> {
	const cjsFile = new FilePath(
		resolve.sync(uriPath, {basedir: prjDir.asNative})
	);
	const esmFile = buildDir.join(
		'__liferay__',
		'cjs2esm',
		`${bareIdentifier}.js`
	);

	await generateCjsEjsBridge(bareIdentifier, cjsFile, esmFile);

	return `./${buildDir.relative(esmFile).asPosix}`;
}
