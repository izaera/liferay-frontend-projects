/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {FilePath, format} from '@liferay/js-toolkit-core';
import fs from 'fs';
import sass from 'sass';

import abort from './abort';
import findFiles from './findFiles';
import sassImporter from './sassImporter';

const {info, print} = format;

export interface SaasConfig {
	sourceMaps: boolean;
}

export default function runSass(
	srcDir: FilePath,
	buildDir: FilePath,
	config: SaasConfig
): void {
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
				...config,
				file: scssFile.asNative,
				importer: sassImporter,
				outFile: outFile.asNative,
			});

			fs.mkdirSync(outFile.dirname().asNative, {recursive: true});

			fs.writeFileSync(outFile.asNative, css, 'utf8');

			if (map) {
				fs.writeFileSync(`${outFile.asNative}.map`, map, 'utf8');
			}
		}
		catch (error) {
			abort(error);
		}
	});
}
