#!/usr/bin/env node

/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

const {build, clean, deploy} = require('@liferay/portal-base');
const {
	error,
	print,
	title,
} = require('liferay-npm-build-tools-common/lib/format');

const pkgJson = require('./package.json');

if (process.argv.length < 3) {
	print(error`No command provided`);
	process.exit(1);
}

const cmd = process.argv[2];

switch (cmd) {
	case 'build':
		print(title`Building project for target platform: {${pkgJson.name}}`);
		build();
		break;

	case 'clean':
		print(title`Cleaning output folders`);
		clean();
		break;

	case 'deploy':
		print(title`Deploying project to Liferay local installation`);
		deploy();
		break;

	default:
		print(error`Unknown command: {${cmd}}`);
		process.exit(1);
		break;
}
