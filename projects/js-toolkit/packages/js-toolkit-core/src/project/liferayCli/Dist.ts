/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import FilePath from '../../file/FilePath';
import LiferayJson from '../../schema/LiferayJson';
import Build from './Build';
import Project from './Project';

export default class Dist {
	readonly dir: FilePath | null;
	readonly file: FilePath | null;

	constructor(_project: Project, liferayJson: LiferayJson, build: Build) {
		switch (build.type) {
			case '@angular/cli':
			case 'customElement':
				this.dir = null;
				this.file = null;
				break;

			case 'bundler2': {
				const {
					default: bundler2Project,
					/* eslint-disable-next-line @typescript-eslint/no-var-requires */
				} = require('liferay-npm-build-tools-common/lib/project');

				this.dir = new FilePath(
					bundler2Project.jar.outputDir.asNative
				).resolve();
				this.file = this.dir.join(bundler2Project.jar.outputFilename);
				break;
			}

			default:
				throw new Error(
					`Unknown project build type type: ${liferayJson.build.type}`
				);
		}
	}
}
