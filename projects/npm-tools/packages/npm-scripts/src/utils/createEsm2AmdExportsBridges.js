/**
 * SPDX-FileCopyrightText: © 2019 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: BSD-3-Clause
 */

/* eslint-disable @liferay/no-dynamic-require */

const {
	addNamespace,
	joinModuleName,
	splitModuleName,
} = require('@liferay/js-toolkit-core');
const fs = require('fs');
const path = require('path');
const resolve = require('resolve');

const flattenPkgName = require('./flattenPkgName');

/**
 * Create .js files to make ES modules available as Liferay-AMD modules.
 *
 * @param {string} projectDir path to project's directory
 * @param {string} outDir path to output directory
 * @param {string[]} exports
 */
function createEsm2AmdExportsBridges(projectDir, outDir, exports) {
	exports.forEach((exportPkgName) => {
		const {pkgName, scope} = splitModuleName(exportPkgName);

		const scopedPkgName = joinModuleName(scope, pkgName, '');

		const rootPkgJson = require(path.join(projectDir, 'package.json'));

		const namespacedScopedPkgName = addNamespace(
			scopedPkgName,
			rootPkgJson
		);

		const pkgJson = require(resolve.sync(`${scopedPkgName}/package.json`, {
			basedir: projectDir,
		}));

		const packageDir = path.join(
			outDir,
			'node_modules',
			getPackageTargetDir({
				name: namespacedScopedPkgName,
				version: pkgJson.version,
			})
		);

		fs.mkdirSync(packageDir, {recursive: true});

		fs.writeFileSync(
			path.join(packageDir, 'package.json'),
			JSON.stringify(
				{
					dependencies: {},
					main: './index.js',
					name: namespacedScopedPkgName,
					version: pkgJson.version,
				},
				null,
				'\t'
			),
			'utf8'
		);

		let bridgeSource = '';

		const flattenedPkgName = flattenPkgName(exportPkgName);

		// TODO: use Web-ContextPath instead of rootPkgJson.name

		bridgeSource += `import * as esModule from `;
		bridgeSource += `"../../../../${rootPkgJson.name}`;
		bridgeSource += `/__liferay__/exports/${flattenedPkgName}.js";`;

		bridgeSource += '\n';
		bridgeSource += '\n';

		bridgeSource += `Liferay.Loader.define(`;
		bridgeSource += `"${namespacedScopedPkgName}@${pkgJson.version}/index"`;
		bridgeSource += `, ['module'], function (module) {`;

		bridgeSource += '\n';

		bridgeSource += `  module.exports = esModule;`;

		bridgeSource += '\n';

		bridgeSource += `});`;

		fs.writeFileSync(
			path.join(packageDir, 'index.js'),
			bridgeSource,
			'utf8'
		);
	});
}

function getPackageTargetDir(pkgJson) {
	const {name, version} = pkgJson;

	let targetFolder = name.replace('/', '%2F');

	if (version) {
		targetFolder += `@${version}`;
	}

	return targetFolder;
}

module.exports = createEsm2AmdExportsBridges;
