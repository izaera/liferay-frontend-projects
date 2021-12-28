/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {FilePath, PkgJson} from '@liferay/js-toolkit-core';
import fs from 'fs';

export default function getEntryPoint(
	pkgDir: FilePath,
	mode: 'cjs' | 'esm'
): string | undefined {
	const pkgJson = require(pkgDir.join('package.json').resolve()
		.asNative) as PkgJson;

	let entryPoint: string;
	let useDefault: boolean = false;

	if (mode === 'cjs') {
		entryPoint = pkgJson['main'] as string;
		useDefault = pkgJson['type'] !== 'module';
	}
	else if (mode === 'esm') {
		entryPoint = pkgJson['module'] as string;
		useDefault = pkgJson['type'] === 'module';
	}

	if (useDefault && !entryPoint) {
		for (const file of ['./index.js', './src/index.js']) {
			if (fs.existsSync(pkgDir.join(file).resolve().asNative)) {
				entryPoint = file;
				break;
			}
		}
	}

	if (!entryPoint) {
		return undefined;
	}

	return new FilePath(entryPoint, {posix: true}).toDotRelative().asPosix;
}
