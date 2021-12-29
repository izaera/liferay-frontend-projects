/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import babelPresetEnv from '@babel/preset-env';
import babelPresetReact from '@babel/preset-react';
import {
	FilePath,
	format,
	joinModuleName,
	splitModuleName,
} from '@liferay/js-toolkit-core';
import fs from 'fs';
import webpack from 'webpack';
import WebpackError from 'webpack/lib/WebpackError';

import Project, {CustomElementBuildOptions} from './Project';

const {debug, fail, info, print, text} = format;

export default async function runWebpack(project: Project): Promise<void> {
	const {buildDir, buildOptions, dir: prjDir, pkgJson} = project;
	const {externals} = buildOptions as CustomElementBuildOptions;

	const entryPointFile = new FilePath(pkgJson.main || './src/index.js', {
		posix: true,
	}).toDotRelative();

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

	print(info`Running {webpack} on {${entryPointFile.asPosix}}...`);

	const stats: webpack.Stats = await new Promise((resolve) => {
		const compiler = webpack(configuration);

		compiler.hooks.done.tap('portal-base', (stats) => {
			resolve(stats);
		});

		compiler.run(undefined);
	});

	print(debug`Created assets:`);

	Object.entries(stats.compilation.assets).forEach(
		([filePath, sizeSource]) => {
			let size = sizeSource.size();
			let unit = 'B';

			if (size > 1024) {
				size = Math.floor(sizeSource.size() / 1024);
				unit = 'KiB';
			}

			if (size > 1024) {
				size =
					Math.floor((10 * sizeSource.size()) / (1024 * 1024)) / 10;
				unit = 'MiB';
			}

			print(text`    * {${filePath}}: ${size} ${unit}`);
		}
	);

	print(debug`External modules:`);

	if (!Object.keys(externals).length) {
		print(text`    (none)`);
	}
	else {
		Object.entries(externals).forEach(([from, to]) => {
			print(text`    * {${from}} (mapped to {${to}})`);
		});
	}

	print(debug`Bundled modules per package:`);

	const summary = Array.from(stats.compilation.modules)
		.map((mod) => mod['resource'])
		.filter((filePath) => filePath)
		.map((filePath) => project.dir.relative(filePath).asPosix)
		.filter((filePath) => filePath.startsWith('node_modules/'))
		.map((filePath) => filePath.substring(13))
		.reduce((summary, moduleName) => {
			const parts = splitModuleName(moduleName);
			const pkgName = joinModuleName(parts.scope, parts.pkgName, '');

			summary[pkgName] = summary[pkgName] || 0;
			summary[pkgName]++;

			return summary;
		}, {});

	Object.keys(summary)
		.sort()
		.forEach((pkgName) => {
			print(text`    * {${pkgName}}: ${summary[pkgName]}`);
		});

	if (stats.hasErrors()) {
		abortWithErrors(stats);
	}
}

function abortWithErrors(stats: webpack.Stats): void {
	const {errors} = stats.compilation;

	errors.forEach((error) => {
		const webpackError = new ExplainedError(error);

		print(fail`${webpackError.toString()}\n`);
	});

	print(fail`Build failed: webpack build finished with errors`);
	process.exit(1);
}

interface ExplainedErrorOptions {
	filePath?: string;
	sourceCode?: string;
}

class ExplainedError extends Error {
	static CONTEXT_LINES = 5;

	constructor(error: Error, options: ExplainedErrorOptions = {}) {
		super();

		this._error = error;
		this._explanation = this._explainError(error, options);
	}

	public toString(): string {
		return this._explanation;
	}

	private _explainError(
		error: Error,
		options: ExplainedErrorOptions
	): string {
		let filePath = options.filePath;
		let sourceCode = options.sourceCode;
		let line: number;

		if (error instanceof WebpackError) {
			filePath = error['module'] && error['module']['userRequest'];
		}
		else if (error instanceof SyntaxError) {
			line = error['loc']['line'];
		}

		if (filePath) {
			if (!sourceCode) {
				try {
					sourceCode = fs.readFileSync(filePath, 'utf8');
				}
				catch (error) {
					sourceCode = '<no source code available>';
				}
			}
		}
		else {
			filePath = '<unknown file>';
		}

		const contextLines =
			sourceCode && line ? this._getContextLines(sourceCode, line) : '';

		return `${error.toString()}${contextLines}\n...at ${filePath}`;
	}

	private _getContextLines(sourceCode: string, aroundLine: number): string {
		const lines = sourceCode.toString().split('\n');

		const beginLine = Math.max(
			1,
			aroundLine - ExplainedError.CONTEXT_LINES
		);
		const endLine = Math.min(
			aroundLine + ExplainedError.CONTEXT_LINES,
			lines.length
		);

		const padMinChars = beginLine.toString().length;

		return `

${lines
	.slice(beginLine - 1, endLine)
	.map((line, i) => {
		i += beginLine;

		const errorMarker = i === aroundLine ? '>' : ' ';
		const lineNumber = i.toString().padStart(padMinChars);

		return `${errorMarker} ${lineNumber}: ${line}`;
	})
	.join('\n')}
`;
	}

	readonly _error: Error;
	readonly _explanation: string;
}
