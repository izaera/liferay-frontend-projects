/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {format} from '@liferay/js-toolkit-core';
import webpack from 'webpack';

import ExplainedError from './ExplainedError';

const {fail, print} = format;

export default function abortWithErrors(stats: webpack.Stats): void {
	const {errors} = stats.compilation;

	errors.forEach((error) => {
		const webpackError = new ExplainedError(error);

		print(fail`${webpackError.toString()}\n`);
	});

	print(fail`Build failed: webpack build finished with errors`);
	process.exit(1);
}
