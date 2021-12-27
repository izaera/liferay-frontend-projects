/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {format} from '@liferay/js-toolkit-core';
import type webpack from 'webpack';

import ExplainedWebpackError from './ExplainedWebpackError';

const {fail, print} = format;

export default function abort(error: Error | string): void {
	if (error['stack']) {
		print('', error['stack'], '');
	}
	else {
		print('', error.toString(), '');
	}

	print(fail`Build failed`);
	process.exit(1);
}

export function abortWebpack(stats: webpack.Stats): void {
	const {errors} = stats.compilation;

	errors.forEach((error) => {
		print(fail`${new ExplainedWebpackError(error).toString()}\n`);
	});

	print(fail`Build failed: webpack build finished with errors`);
	process.exit(1);
}
