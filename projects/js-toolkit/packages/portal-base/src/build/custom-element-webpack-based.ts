/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import babelPresetReact from '@babel/preset-react';
import {FilePath, PkgJson, format} from '@liferay/js-toolkit-core';
import fs from 'fs';
import project from 'liferay-npm-build-tools-common/lib/project';
import webpack from 'webpack';

import {abortWebpack} from '../util/abort';
import runSass from '../util/runSass';

const {info, print, success, text, warn} = format;

const prjDir = new FilePath(project.dir.asNative);
const buildDir = new FilePath(project.buildDir.asNative);

const srcDir = prjDir.join('src');

export default async function build(): Promise<void> {
	fs.mkdirSync(buildDir.asNative, {recursive: true});

	print(
		'',
		warn`WARNING: Using the experimental {custom elements webpack} build`,
		'',
		text`
The custom elements webpack build is under heavy development and may break now
or in the future. Use it at you own risk and keep in mind that you will {NOT}
get any type of support related to this type of build.
		  `,
		text`Have fun, in any case |🙌|`,
		''
	);

	if (fs.existsSync(prjDir.join('importmap.json').asNative)) {

		// For now we will ignore importmap.json but in the future we may use it
		// to be able to use portal's `react`, for example. The technique used
		// to do it would be the same we use in bundler 3.

		print(
			warn`WARNING: Using a build based on webpack, {importmap.json} will be ignored`
		);
	}

	runSass(srcDir, buildDir, {
		sourceMaps: false,
	});

	await runWebpack(prjDir, buildDir, project.pkgJson as PkgJson);

	print(success`{Project successfully built}`);
}

async function runWebpack(
	prjDir: FilePath,
	buildDir: FilePath,
	pkgJson: PkgJson
): Promise<void> {
	const entryPointFile = new FilePath(pkgJson.main || './src/index.js', {
		posix: true,
	}).toDotRelative();

	const outputFileName = entryPointFile.basename().asPosix;

	const configuration: webpack.Configuration = {
		entry: {
			[outputFileName]: {
				import: prjDir.join(entryPointFile).asPosix,
				filename: `./${outputFileName}`,
			},
		},
		mode: 'development',
		module: {
			rules: [
				{
					test: /\.js$/,
					exclude: /node_modules/,
					use: {
						loader: 'babel-loader',
						options: {
							presets: [babelPresetReact],
						},
					},
				},
				{
					test: /\.css$/i,
					use: ['style-loader', 'css-loader'],
				},
			],
		},
		output: {
			path: buildDir.resolve().asNative,
		},
	};

	print(
		info`Running {webpack} with entry point {${entryPointFile.asPosix}}...`
	);

	const stats: webpack.Stats = await new Promise((resolve) => {
		const compiler = webpack(configuration);

		compiler.hooks.done.tap('portal-base', (stats) => {
			resolve(stats);
		});

		compiler.run(undefined);
	});

	if (stats.hasErrors()) {
		abortWebpack(stats);
	}
}
