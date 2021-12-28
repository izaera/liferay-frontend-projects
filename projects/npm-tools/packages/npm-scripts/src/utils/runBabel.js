/**
 * SPDX-FileCopyrightText: © 2019 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: BSD-3-Clause
 */

const getMergedConfig = require('./getMergedConfig');
const spawnSync = require('./spawnSync');
const withTempFile = require('./withTempFile');

const BABEL_CONFIG = getMergedConfig('babel');

/**
 * Runs babel with given args and uses a temp .babelrc file
 */
function runBabel(...args) {
	withTempFile('.babelrc', JSON.stringify(BABEL_CONFIG), (babelRcPath) => {
		spawnSync('babel', [
			'--no-babelrc',
			'--config-file',
			babelRcPath,
			'--ignore',
			'**/__liferay__/**',
			...args,
		]);
	});
}

module.exports = runBabel;
