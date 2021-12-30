/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import babelPresetEnv from '@babel/preset-env';
import babelPresetReact from '@babel/preset-react';
import webpack from 'webpack';

import Project, {CustomElementBuildOptions} from '../util/Project';

export default function createConfig(project: Project): webpack.Configuration {
	switch (project.buildType) {
		case 'customElement':
			return createCustomElementConfig(project);

		default:
			throw new Error(`Unsupported build type ${project.buildType}`);
	}
}

function createCustomElementConfig(project: Project): webpack.Configuration {
	const {buildDir, buildOptions, dir: prjDir, entryPointFile} = project;
	const {externals} = buildOptions as CustomElementBuildOptions;

	const outputFileName = entryPointFile.basename().asPosix;

	const configuration: webpack.Configuration = {
		devtool: 'cheap-source-map',
		entry: {
			[outputFileName]: {
				import: prjDir.join(entryPointFile).asPosix,
				filename: `./${outputFileName}`,
			},
		},
		experiments: {
			outputModule: true,
		},
		externals,
		externalsType: 'module',
		mode: 'development',
		module: {
			rules: [
				{
					test: /\.js$/,
					exclude: /node_modules/,
					use: {
						loader: 'babel-loader',
						options: {
							presets: [babelPresetEnv, babelPresetReact],
						},
					},
				},
				{
					test: /\.css$/i,
					use: [
						require.resolve('style-loader'),
						require.resolve('css-loader'),
					],
				},
			],
		},
		output: {
			path: buildDir.resolve().asNative,
			library: {
				type: 'module',
			},
			environment: {
				dynamicImport: true,
				module: true,
			},
		},
	};

	return configuration;
}
