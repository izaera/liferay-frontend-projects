/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {Project, format} from '@liferay/js-toolkit-core';

import abort from '../util/abort';
import angularCli from './angularCli';
import bundler2 from './bundler2';
import customElement from './customElement';

const {print, success} = format;

export default async function build(): Promise<void> {
	const project = new Project('.');

	try {
		switch (project.build.type) {
			case '@angular/cli':
				await angularCli(project);
				break;

			case 'customElement':
				await customElement(project);
				break;

			case 'bundler2':
				await bundler2(project);
				break;

			default:
				abort(`Unknown project build type: ${project.build.type}`);
				break;
		}

		print(success`{Project successfully built}`);
	}
	catch (error) {
		abort(`Build failed!\n${error.stack}`);
	}
}
