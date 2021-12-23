/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import babelPresetReact from '@babel/preset-react';
import {FilePath, format} from '@liferay/js-toolkit-core';
import fs from 'fs';
import project from 'liferay-npm-build-tools-common/lib/project';

import runBabel from '../util/runBabel';
import runSass from '../util/runSass';

const {print, success, text, warn} = format;

const prjDir = new FilePath(project.dir.asNative);
const buildDir = new FilePath(project.buildDir.asNative);

const srcDir = prjDir.join('src');

export default async function build(): Promise<void> {
	fs.mkdirSync(buildDir.asNative, {recursive: true});

	print(
		'',
		warn`WARNING: Using the experimental {custom elements} build`,
		'',
		text`
The custom elements build is under heavy development and may break now or in the
future. Use it at you own risk and keep in mind that you will {NOT} get any type
of support related to this type of build.
		  `,
		text`Have fun, in any case |🙌|`,
		''
	);

	runSass(srcDir, buildDir, {
		sourceMaps: false,
	});

	// TODO: run tsc instead of babel where needed

	runBabel(srcDir, buildDir, {
		presets: [babelPresetReact],
		sourceMaps: false,
	});

	print(success`{Project successfully built}`);
}
