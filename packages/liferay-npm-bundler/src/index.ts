/**
 * © 2017 Liferay, Inc. <https://liferay.com>
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import fs from 'fs-extra';
import project from 'liferay-npm-build-tools-common/lib/project';
import path from 'path';
import pretty from 'pretty-time';
import readJsonSync from 'read-json-sync';
import semver from 'semver';
import yargs from 'yargs';

import {addPackageDependencies, getRootPkg} from './dependencies';
import * as insight from './insight';
import createJar from './jar';
import * as log from './log';
import manifest from './manifest';
import report from './report';

import copyPackages from './steps/copy';
import runRules from './steps/rules';
import transformPackages from './steps/transform';

/** Default entry point for the liferay-npm-bundler */
export default function(): void {
	const {argv} = yargs
		.option('config', {
			alias: 'c',
			type: 'string',
			description:
				'Specify path to config file to use (instead of .npmbundlerrc)',
		})
		.option('create-jar', {
			alias: 'j',
			type: 'boolean',
			description:
				'Create a JAR file as output (as opposed to an exploded directory)',
		})
		.option('dump-report', {
			alias: 'r',
			type: 'boolean',
			description:
				'Dump report HTML file with detailed information about the bundling process',
		})
		.option('version', {
			alias: 'v',
			type: 'boolean',
			description: 'Show version number and exit',
		})
		.help();

	project.argv = argv;

	const versionsInfo = project.versionsInfo;

	if (argv.version) {
		versionsInfo.forEach((value, key) => {
			console.log(`"${key}":`, JSON.stringify(value, null, 2));
		});
		return;
	}

	report.versionsInfo(versionsInfo);

	if (project.misc.noTracking) {
		run();
	} else {
		log.debug(
			'The tool is sending usage statistics to our remote servers.'
		);
		insight.init().then(run);
	}
}

/** Real tool execution */
function run(): void {
	try {
		const start = process.hrtime();

		// Get root package
		const rootPkg = getRootPkg();

		report.rootPackage(rootPkg);

		// Compute dependency packages
		const depPkgsMap = addPackageDependencies(
			{},
			project.dir.asNative,
			project.copy.includedDependencies
		);

		const depPkgs = Object.values(depPkgsMap).filter(pkg => !pkg.isRoot);

		report.dependencies(depPkgs);
		reportLinkedDependencies(project.pkgJson);

		// Report rules config
		report.rulesConfig(project.rules.config);

		// Warn about incremental builds
		if (manifest.loadedFromFile) {
			report.warn(
				'This report is from an incremental build: some steps may be ' +
					'missing (you may remove the output directory to force a ' +
					'full build).'
			);
		}

		// Do things
		copyPackages(rootPkg, depPkgs)
			.then(() => runRules(rootPkg, depPkgs))
			.then(() => transformPackages(rootPkg, depPkgs))
			.then(() => manifest.save())
			.then(() => (project.jar.supported ? createJar() : undefined))
			.then(() => {
				// Report and show execution time
				const hrtime = process.hrtime(start);
				report.executionTime(hrtime);
				log.info(`Bundling took ${pretty(hrtime)}`);

				// Send report analytics data
				report.sendAnalytics();

				// Write report if requested
				if (project.misc.reportFile) {
					fs.writeFileSync(
						project.misc.reportFile.asNative,
						report.toHtml()
					);

					log.info(
						`Report written to ${project.misc.reportFile.asNative}`
					);
				} else if (report.warningsPresent) {
					log.debug('The build has emitted some warning messages.');
				}
			})
			.catch(abort);
	} catch (err) {
		abort(err);
	}
}

/** Report linked dependencies of a given package.json */
function reportLinkedDependencies(pkgJson: object): void {
	['dependencies', 'devDependencies'].forEach(scope => {
		if (pkgJson[scope] != null) {
			Object.keys(pkgJson[scope]).forEach(depName => {
				const depVersion = pkgJson[scope][depName];

				if (semver.validRange(depVersion) == null) {
					const depPkgJsonPath = path.join(
						'node_modules',
						depName,
						'package.json'
					);

					const depPkgJson = readJsonSync(depPkgJsonPath);

					pkgJson[scope][depName] = depPkgJson.version;

					report.linkedDependency(
						depName,
						depVersion,
						depPkgJson.version
					);
				}
			});
		}
	});
}

/** Abort execution after showing error message */
function abort(err: any): void {
	log.error(`

${err.stack}

`);

	process.exit(1);
}
