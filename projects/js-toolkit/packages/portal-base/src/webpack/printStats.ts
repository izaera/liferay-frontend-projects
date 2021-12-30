/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {
	FilePath,
	format,
	joinModuleName,
	splitModuleName,
} from '@liferay/js-toolkit-core';
import webpack from 'webpack';

const {debug, print, text} = format;

export default function printStats(
	stats: webpack.Stats,
	projectDir: FilePath
): void {
	print(debug`Bundled modules per package:`);

	const summary = Array.from(stats.compilation.modules)
		.map((mod) => mod['resource'])
		.filter((filePath) => filePath)
		.map((filePath) => projectDir.relative(filePath).asPosix)
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

	print(debug`Output assets:`);

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
}
