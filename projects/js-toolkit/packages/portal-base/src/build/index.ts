/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import bundlerBased from './bundler-based';
import browserModulesBased from './browser-modules-based';
import * as configuration from '../util/configuration';

export default async function build(): Promise<void> {
	const buildType = configuration.get('build', 'type');

	switch (buildType) {
		case 'ufesm':
			return browserModulesBased();

		default:
			return bundlerBased();
	}
}
