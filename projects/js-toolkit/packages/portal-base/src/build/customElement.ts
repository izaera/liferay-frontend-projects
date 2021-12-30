/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {format} from '@liferay/js-toolkit-core';
import fs from 'fs';

import abort from '../util/abort';
import Project from '../util/Project';
import runSass from '../util/runSass';
import runWebpack from '../webpack/runWebpack';

const {print, text, warn} = format;

export default async function customElement(project: Project): Promise<void> {
	print(
		'',
		warn`WARNING: Using the experimental {custom-element} build`,
		'',
		text`
The custom-element build is under heavy development and may break now or in the
future.

Use it at you own risk and keep in mind that you will {NOT} get any type of
support related to this type of build.
		  `,
		text`Have fun, in any case |🙌|`,
		''
	);

	fs.mkdirSync(project.buildDir.asNative, {recursive: true});

	checkConfiguration(project);
	runSass(project);
	await runWebpack(project);
}

function checkConfiguration(project: Project): void {
	if (project.pkgJson.type === 'module') {
		abort(
			'Custom element projects cannot be of {type module} (see {package.json})'
		);
	}
}
