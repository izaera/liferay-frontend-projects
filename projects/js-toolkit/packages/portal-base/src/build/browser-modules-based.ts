/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {FilePath, format} from '@liferay/js-toolkit-core';
import fs from 'fs';
import project from 'liferay-npm-build-tools-common/lib/project';
import path from 'path';

import abort from '../util/abort';
import copyAssets from '../util/copyAssets';
import findFiles from '../util/findFiles';
import processImportmapJson from '../util/processImportmapJson';
import runSass from '../util/runSass';
import spawn from '../util/spawn';

const {info, print, success, text, warn} = format;

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

	await processImportmapJson(prjDir, buildDir);

	copyDependencies();

	copyAssets(srcDir, buildDir, (dirent) => {
		const lowerCaseName = dirent.name.toLowerCase();

		return !lowerCaseName.endsWith('.scss');
	});

	runSass(srcDir, buildDir, {
		sourceMaps: true,
	});

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
