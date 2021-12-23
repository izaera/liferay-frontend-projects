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
import runBabel from '../util/runBabel';
import sassImporter from '../util/sassImporter';
import spawn from '../util/spawn';

const {info, print, success} = format;

const srcDir = new FilePath(project.dir.join('src').asNative);
const buildDir = new FilePath(project.buildDir.asNative);

export default async function build(): Promise<void> {
	fs.mkdirSync(buildDir.asNative, {recursive: true});

	copyAssets();
	runSass();
	runCompiler();
	runBundler();

	print(success`{Project successfully built}`);
}

function copyAssets(): void {
	const assetFiles = findFiles(srcDir, (dirent) => {
		const lowerCaseName = dirent.name.toLowerCase();

		return (
			!lowerCaseName.endsWith('.js') && !lowerCaseName.endsWith('.scss')
		);
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

function runCompiler(): void {
	const dependencies = project.pkgJson['dependencies'] || {};
	const devDependencies = project.pkgJson['devDependencies'] || {};

	if (devDependencies['typescript'] || dependencies['typescript']) {
		runTsc();
	}
	else {
		runBabel(srcDir, buildDir, {
			presets: [babelPresetEnv, babelPresetReact],
			sourceMaps: true,
		});
	}
}

function runBundler(): void {
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

	print(info`Running {liferay-npm-bundler}...`);

	spawn('node', [bundlerPath]);
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

function runTsc(): void {
	print(info`Running {tsc} compiler...`);

	spawn('npx', ['tsc']);
}
