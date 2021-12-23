/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import * as babel from '@babel/core';
import {FilePath, format} from '@liferay/js-toolkit-core';
import fs from 'fs';

import abort from './abort';
import findFiles from './findFiles';

const {info, print} = format;

export interface BabelConfig {
	presets: object[];
	sourceMaps: boolean;
}

export default function runBabel(
	srcDir: FilePath,
	buildDir: FilePath,
	config: BabelConfig
): void {
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
					...config,
					filename: jsFile.asNative,
				}
			);

			fs.writeFileSync(
				buildDir.join(srcDirRelJsFile).asNative,
				code,
				'utf8'
			);

			if (map) {
				fs.writeFileSync(
					buildDir.join(`${srcDirRelJsFile}.map`).asNative,
					JSON.stringify(map),
					'utf8'
				);
			}
		}
		catch (babelError) {
			abort(babelError);
		}
	});
}
