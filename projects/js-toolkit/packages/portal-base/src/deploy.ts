/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {FilePath, format} from '@liferay/js-toolkit-core';
import fs from 'fs';
import {createInterface} from 'readline';

import Project from './util/Project';

const {fail, print, question, success} = format;

export default async function deploy(): Promise<void> {
	const project = new Project('.');

	let {deployDir} = project;

	if (!deployDir) {
		deployDir = await promptForDeployPath(project);
	}

	if (!deployDir) {
		print(fail`No path to Liferay installation given: cannot deploy`);
		process.exit(1);
	}

	const {distFile} = project;

	if (!fs.existsSync(distFile.asNative)) {
		print(
			fail`Bundle {${distFile}} does not exist; please build it before deploying`
		);
		process.exit(1);
	}

	fs.copyFileSync(
		distFile.asNative,
		deployDir.join(distFile.basename().asNative).asNative
	);

	print(
		success`Bundle {${distFile.basename().asNative}} deployed to {${
			deployDir.asNative
		}}`
	);
}

async function promptForDeployPath(project: Project): Promise<FilePath> {
	const lines = createInterface({
		input: process.stdin,
	});

	print(question`Please enter your local Liferay installation directory`);

	let deployDir: FilePath;

	for await (const line of lines) {
		deployDir = new FilePath(line).join('osgi', 'modules').resolve();

		if (fs.existsSync(deployDir.asNative)) {
			project.storeDeployDir(deployDir);

			break;
		}
		else {
			print(fail`${deployDir.asNative} does not exist`);
			print(
				question`Please enter your local Liferay installation directory`
			);
		}
	}

	return deployDir;
}
