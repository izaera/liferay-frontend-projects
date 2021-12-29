/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import * as babel from '@babel/core';
import babelPresetEnv from '@babel/preset-env';
import babelPresetReact from '@babel/preset-react';
import {format} from '@liferay/js-toolkit-core';
import fs from 'fs';
import path from 'path';

import Project from '../util/Project';
import abort from '../util/abort';
import findFiles from '../util/findFiles';
import runSass from '../util/runSass';
import spawn from '../util/spawn';

const {info, print} = format;

export default async function bundler2(project: Project): Promise<void> {
	fs.mkdirSync(project.buildDir.asNative, {recursive: true});

	copyAssets(project);
	runSass(project);
	runCompiler(project);
	runBundler();
}

function copyAssets(project: Project): void {
	const {buildDir, srcDir} = project;

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

function runBabel(project: Project): void {
	const {buildDir, srcDir} = project;

	const jsFiles = findFiles(srcDir, (dirent) =>
		dirent.name.toLowerCase().endsWith('.js')
	);

	print(info`Running {babel} on ${jsFiles.length} files...`);

	jsFiles.forEach((jsFile) => {
		const srcDirRelJsFile = srcDir.relative(jsFile);

		try {
			const {code, map} = babel.transformSync(
				fs.readFileSync(jsFile.asNative, 'utf8'),
				{
					filename: jsFile.asNative,
					presets: [babelPresetEnv, babelPresetReact],
					sourceMaps: true,
				}
			);

			fs.writeFileSync(
				buildDir.join(srcDirRelJsFile).asNative,
				code,
				'utf8'
			);

			fs.writeFileSync(
				buildDir.join(`${srcDirRelJsFile}.map`).asNative,
				JSON.stringify(map),
				'utf8'
			);
		}
		catch (babelError) {
			abort(babelError);
		}
	});
}

function runCompiler(project: Project): void {
	const dependencies = project.pkgJson['dependencies'] || {};
	const devDependencies = project.pkgJson['devDependencies'] || {};

	if (devDependencies['typescript'] || dependencies['typescript']) {
		runTsc();
	}
	else {
		runBabel(project);
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

function runTsc(): void {
	print(info`Running {tsc} compiler...`);

	spawn('npx', ['tsc']);
}
