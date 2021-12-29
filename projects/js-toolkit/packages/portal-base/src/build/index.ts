/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {format} from '@liferay/js-toolkit-core';

import abort from '../util/abort';
import Project from '../util/Project';
import bundler2 from './bundler2';
import customElement from './customElement';

const {print, success} = format;

export default async function build(): Promise<void> {
	const project = new Project('.');

	try {
		switch (project.buildType) {
			case 'customElement':
				await customElement(project);
				break;

			default:
				await bundler2(project);
				break;
		}

		print(success`{Project successfully built}`);
	}
	catch (error) {
		abort(`Build failed!\n${error.stack}`);
	}
}
