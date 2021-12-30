/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {format} from '@liferay/js-toolkit-core';
import webpack from 'webpack';

import Project, {CustomElementBuildOptions} from '../util/Project';
import abortWithError from './abortWithError';
import createConfig from './createConfig';
import printStats from './printStats';

const {debug, info, print, text} = format;

export default async function runWebpack(project: Project): Promise<void> {
	const {buildOptions, entryPointFile} = project;
	const {externals} = buildOptions as CustomElementBuildOptions;

	const configuration = createConfig(project);

	print(info`Running {webpack} on {${entryPointFile.asPosix}}...`);

	const stats: webpack.Stats = await new Promise((resolve) => {
		const compiler = webpack(configuration);

		compiler.hooks.done.tap('portal-base', (stats) => {
			resolve(stats);
		});

		compiler.run(undefined);
	});

	if (stats.hasErrors()) {
		abortWithError(stats);
	}
	else {
		print(debug`External modules:`);

		if (!Object.keys(externals).length) {
			print(text`    (none)`);
		}
		else {
			Object.entries(externals).forEach(([from, to]) => {
				print(text`    * {${from}} (mapped to {${to}})`);
			});
		}

		printStats(stats, project.dir);
	}
}
