/**
 * SPDX-FileCopyrightText: © 2020 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {
	BuilderContext,
	BuilderOutput,
	createBuilder,
} from '@angular-devkit/architect';
import {JsonObject} from '@angular-devkit/core';

//import {promises as fs} from 'fs';

interface Options extends JsonObject {
	source: string;
	destination: string;
}

export default createBuilder(copyFileBuilder);

async function copyFileBuilder(
	options: Options,
	context: BuilderContext
): Promise<BuilderOutput> {
	console.log(new Error('xxx').stack);

	context.reportStatus(`Holi from angular/builder`);

	const packageJson = require('@angular-devkit/build-angular/package.json');

	console.log(packageJson['builders']);

	const buildersJson = require(`@angular-devkit/build-angular/${packageJson['builders']}`);

	const browserBuilder = require(`@angular-devkit/build-angular/${buildersJson['builders']['browser']['implementation']}`);

	const handler = browserBuilder['buildWebpackBrowser'];

	context.reportStatus('Adiosito.');

	const result = handler(options, context);

	console.log(result);

	return result;

	//console.log(options);
	//console.log(context);

	//return {success: true};

}
