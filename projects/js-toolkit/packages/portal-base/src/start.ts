/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import webpack from 'webpack';
import webpackDevServer from 'webpack-dev-server';

import Project from './util/Project';
import createConfig from './webpack/createConfig';

export default async function start(): Promise<void> {
	const project = new Project('.');

	const config = createConfig(project);
	const compiler = webpack(config);

	const devServerOptions = {
		headers: [
			{
				key: 'access-control-allow-headers',
				value: 'Origin, X-Requested-With, Content-Type, Accept, Range',
			},
			{
				key: 'access-control-allow-origin',
				value: '*',
			},
		],
		port: 8081,
		static: {
			directory: project.srcDir.asNative,
		},
	};

	const server = new webpackDevServer(devServerOptions, compiler);

	await server.start();
}
