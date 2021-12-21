/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import * as babel from '@babel/core';
import babelPresetEnv from '@babel/preset-env';
import babelPresetReact from '@babel/preset-react';
import {FilePath, format} from '@liferay/js-toolkit-core';
import fs from 'fs';
import project from 'liferay-npm-build-tools-common/lib/project';
import path from 'path';
import sass from 'sass';

import abort from '../util/abort';
import findFiles from '../util/findFiles';
import sassImporter from '../util/sassImporter';
import spawn from '../util/spawn';
import generateCjsEjsBridge from './generateCjsEsmBridge';

const {info, print, success, text, warn} = format;

interface ImportmapJson {
	[bareIdentifier: string]: string;
}

const prjDir = new FilePath(project.dir.asNative);
const buildDir = new FilePath(project.buildDir.asNative);

const nodeModulesDir = prjDir.join('node_modules');
const srcDir = prjDir.join('src');

export default async function build(): Promise<void> {
	fs.mkdirSync(buildDir.asNative, {recursive: true});

	print(
		'',
		warn`WARNING: Using the experimental {UFESM} build`,
		'',
		text`
The UFESM build is under heavy development and may break now or in the future.
Use it at you own risk and keep in mind that you will {NOT} get any type of
support related to this type of build.
		  `,
		text`Have fun, in any case |🙌|`,
		''
	);

	checkConfiguration();

	await processImportmapJson();
	copyDependencies();
	copyAssets();
	runSass();
	buildJAR();

	print(success`{Project successfully built}`);
}

function buildJAR(): void {
	const bundlerPkgJsonPath = require.resolve(
		'liferay-npm-bundler/package.json'
	);
	const bundlerDir = path.dirname(bundlerPkgJsonPath);

	/* eslint-disable-next-line */
	const bundlerPkgJson = require(bundlerPkgJsonPath);
	const bundlerPath = path.resolve(
		bundlerDir,
		bundlerPkgJson.bin['liferay-npm-bundler']
	);

	print(info`Building {${project.jar.outputFilename}} file...`);

	// TODO: build the JAR without invoking liferay-npm-bundler

	spawn('node', [
		bundlerPath,
		'-c',
		path.resolve(__dirname, 'browser-modules-based.npmbundlerrc'),
	]);
}

function checkConfiguration(): void {
	if (project.pkgJson['type'] !== 'module') {
		abort(
			`
This build type (ufesm) can only be used with projects containing a declaration
{"type": "module"} in their {package.json} file.`
		);
	}
}

function copyAssets(): void {
	const assetFiles = findFiles(srcDir, (dirent) => {
		const lowerCaseName = dirent.name.toLowerCase();

		return !lowerCaseName.endsWith('.scss');
	});

	print(info`Copying ${assetFiles.length} {assets}...`);

	assetFiles.forEach((assetFile) => {
		const srcDirRelAssetFile = srcDir.relative(assetFile);
		const outFile = buildDir.join(srcDirRelAssetFile);

		try {
			fs.mkdirSync(outFile.dirname().asNative, {recursive: true});
			fs.copyFileSync(assetFile.asNative, outFile.asNative);
		}
		catch (error) {
			abort(error);
		}
	});
}

function copyDependencies(): void {

	// TODO: find a way to guess what needs to be copied and make the import map

	const nodeModulesFiles = findFiles(nodeModulesDir, () => true);

	print(info`Copying ${nodeModulesFiles.length} {dependencies}...`);

	nodeModulesFiles.forEach((nodeModulesFile) => {
		const prjDirRelNodeModulesFile = prjDir.relative(nodeModulesFile);
		const outFile = buildDir.join(prjDirRelNodeModulesFile);

		try {
			fs.mkdirSync(outFile.dirname().asNative, {recursive: true});
			fs.copyFileSync(nodeModulesFile.asNative, outFile.asNative);
		}
		catch (error) {
			abort(error);
		}
	});
}

async function processImportmapJson(): Promise<void> {
	const importmap: ImportmapJson = JSON.parse(
		fs.readFileSync(prjDir.join('importmap.json').asNative, 'utf8')
	);

	print(info`Processing import map...`);

	let outImportMap: ImportmapJson = {};

	for await (const [bareIdentifier, uri] of Object.entries(importmap)) {
		if (uri.startsWith('cjs')) {
			const cjsFile = prjDir.join(uri.replace(/^cjs:/, ''));
			const esmFile = buildDir.join(
				'_liferay_',
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

function runSass(): void {
	const scssFiles = findFiles(srcDir, (dirent) => {
		const lowerCaseName = dirent.name.toLowerCase();

		return (
			lowerCaseName.endsWith('.scss') && !lowerCaseName.startsWith('_')
		);
	});
	print(info`Running {sass} on ${scssFiles.length} files...`);

	scssFiles.forEach((scssFile) => {
		const srcDirRelScssFile = srcDir.relative(scssFile);
		const outFile = buildDir.join(
			srcDirRelScssFile.asNative.replace(/\.scss$/, '.css')
		);

		try {
			const {css, map} = sass.renderSync({
				file: scssFile.asNative,
				importer: sassImporter,
				outFile: outFile.asNative,
				sourceMap: true,
			});

			fs.mkdirSync(outFile.dirname().asNative, {recursive: true});

			fs.writeFileSync(outFile.asNative, css, 'utf8');

			fs.writeFileSync(`${outFile.asNative}.map`, map, 'utf8');
		}
		catch (error) {
			abort(error);
		}
	});
}
