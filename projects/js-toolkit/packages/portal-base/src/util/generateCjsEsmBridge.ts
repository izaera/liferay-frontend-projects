import {FilePath, format} from '@liferay/js-toolkit-core';
import fs from 'fs';
import webpack from 'webpack';

import {abortWebpack} from './abort';

const {debug, print} = format;

export default async function generateCjsEsmBridge(
	bareIdentifier: string,
	cjsFile: FilePath,
	esmFile: FilePath
): Promise<void> {
	const webpackFile = await runWebpack(bareIdentifier, cjsFile, esmFile);

	fs.mkdirSync(esmFile.dirname().asNative, {recursive: true});

	fs.writeFileSync(
		esmFile.asNative,
		`
export default await new Promise((resolve, reject) => {
	try {
/* {{{ WEBPACK ************************************************************** */
		${fs.readFileSync(webpackFile.asNative, 'utf8')}
/* }}} WEBPACK ************************************************************** */
		
		resolve(__bundle__);
	} catch(error) {
		reject(error);
	}
});
`,
		'utf8'
	);

	fs.unlinkSync(webpackFile.asNative);
}

async function runWebpack(
	bareIdentifier: string,
	cjsFile: FilePath,
	esmFile: FilePath
): Promise<FilePath> {
	const configuration: webpack.Configuration = {
		entry: {
			[bareIdentifier]: {
				import: cjsFile.isAbsolute()
					? cjsFile.asPosix
					: cjsFile.toDotRelative().asPosix,
				filename: `./${bareIdentifier}.webpack.js`,
			},
		},
		mode: 'development',
		output: {
			library: {
				name: '__bundle__',
				type: 'var',
			},
			path: esmFile.dirname().resolve().asNative,
		},
	};

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

	print(debug`Generated CJS-ESM bridge for {${bareIdentifier}}`);

	return new FilePath(
		`${esmFile.dirname().resolve().asPosix}/${bareIdentifier}.webpack.js`,
		{posix: true}
	);
}
