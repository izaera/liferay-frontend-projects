/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {FilePath} from '@liferay/js-toolkit-core';
import fs from 'fs';

export interface ImportmapJson {
	[bareIdentifier: string]: string;
}

export default function readImportmapJson(prjDir: FilePath): ImportmapJson {
	let json: string;

	try {
		json = fs.readFileSync(prjDir.join('importmap.json').asNative, 'utf8');
	}
	catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}

		json = '{}';
	}

	return JSON.parse(json);
}
