/**
 * SPDX-FileCopyrightText: © 2020 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

export default interface LiferayJson {
	build?: {
		options?: BuildConfig;
		type?: '@angular/cli' | 'bundler2' | 'customElement';
	};
	deploy?: {
		path?: string;
	};
	start?: {
		port?: number;
	};
}

export type BuildConfig =
	| AngularCliBuildConfig
	| Bundler2BuildConfig
	| CustomElementBuildConfig;

export type AngularCliBuildConfig = {
	htmlElementName?: string;
};

export type Bundler2BuildConfig = {};

export interface CustomElementBuildConfig {
	externals: {[bareIdentifier: string]: string} | string[];
	htmlElementName?: string;
}
