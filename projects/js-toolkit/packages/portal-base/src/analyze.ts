/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {FilePath, parseAsAstProgram} from '@liferay/js-toolkit-core';
import {traverse} from 'estraverse';
import fs from 'fs';
import resolve from 'resolve';

import getEntryPoint from './util/getEntryPoint';
import readImportmapJson, {ImportmapJson} from './util/readImportmapJson';

interface Analysis {
	modules: {
		[absPath: string]: ModuleDescriptor;
	};
	packages: {
		[absPath: string]: PackageDescriptor;
	};
	importmap: ImportmapJson;
}

interface ModuleDescriptor {
	exports?: boolean;
	imports?: ModuleImports;
	type: ModuleType;
}

type ModuleType = 'cjs' | 'esm' | 'other';

interface ModuleImports {
	[moduleName: string]: string | false;
}

interface PackageDescriptor {
	entryPoint: {
		cjs?: string;
		esm?: string;
	};
	name: string;
	version: string;
}

const prjDir = new FilePath('.').resolve();

export default async function analyze(): Promise<void> {
	const analysis = analyzeProject(prjDir);

	console.log(JSON.stringify(analysis, null, 2));

	//print(success`Bundle {${outputFile}} deployed to {${deployPath}}`);

}

function analyzeProject(prjDir: FilePath): Analysis {
	const analysis = {
		modules: {},
		packages: {},
		importmap: readImportmapJson(prjDir),
	};

	analyzeModule(
		prjDir.join(new FilePath(getEntryPoint(prjDir, 'esm'), {posix: true})),
		analysis
	);

	const sortedAnalysis: Analysis = {
		modules: {},
		packages: {},
		importmap: analysis.importmap,
	};

	Object.keys(analysis.modules)
		.sort()
		.forEach(
			(key) => (sortedAnalysis.modules[key] = analysis.modules[key])
		);
	Object.keys(analysis.packages)
		.sort()
		.forEach(
			(key) => (sortedAnalysis.packages[key] = analysis.packages[key])
		);

	Object.values(sortedAnalysis.modules).forEach((mod) => {
		if (!mod.imports) {
			return;
		}

		const sortedImports: ModuleImports = {};

		Object.keys(mod.imports)
			.sort()
			.forEach((key) => (sortedImports[key] = mod.imports[key]));

		mod.imports = sortedImports;
	});

	return sortedAnalysis;
}

function analyzeModule(moduleFile: FilePath, analysis: Analysis): void {
	if (analysis.modules[moduleFile.asNative]) {
		return;
	}

	if (!fs.existsSync(moduleFile.asNative)) {
		analysis.modules[moduleFile.asNative] = {
			type: 'other',
		};

		return;
	}

	analyzePackage(findPackageDir(moduleFile), analysis);

	const moduleDir = moduleFile.dirname();

	let exports = false;
	let imports: ModuleImports = {};
	let type: ModuleType = 'esm'; // ESM until we are proved wrong

	try {
		const program = parseAsAstProgram(
			fs.readFileSync(moduleFile.asNative, 'utf8')
		);

		traverse(program, {
			enter(node, _parent): void {
				if (node.type === 'ImportDeclaration') {
					const moduleName = node.source.value as string;

					if (analysis.importmap[moduleName]) {
						imports[moduleName] = false;
					}
					else {

						// TODO: use custom resolve that accounts for ESM

						const importedFile = new FilePath(
							resolve.sync(moduleName, {
								basedir: moduleDir.asNative,
							})
						);

						imports[moduleName] = importedFile.asNative;
					}
				}
				else if (
					node.type === 'CallExpression' &&
					node.callee.type === 'Identifier' &&
					node.callee.name === 'require' &&
					node.arguments.length === 1 &&
					node.arguments[0].type === 'Literal' &&
					typeof node.arguments[0].value === 'string'
				) {
					const moduleName = node.arguments[0].value as string;

					// TODO: use custom resolve that accounts for ESM

					const importedFile = new FilePath(
						resolve.sync(moduleName, {
							basedir: moduleDir.asNative,
						})
					);

					imports[moduleName] = importedFile.asNative;

					type = 'cjs';
				}
				else if (node.type === 'ExportAllDeclaration') {
					exports = true;
				}
				else if (node.type === 'ExportDefaultDeclaration') {
					exports = true;
				}
				else if (node.type === 'ExportNamedDeclaration') {
					exports = true;
				}

				// TODO: look for module.exports and exports

			},

			keys: {
				JSXElement: [],
			},
		});
	}
	catch (error) {
		exports = undefined;
		imports = undefined;
		type = 'other';
	}

	analysis.modules[moduleFile.asNative] = {
		type,
		exports,
		imports,
	};

	if (!imports) {
		return;
	}

	Object.entries(imports).forEach(([, moduleFile]) => {
		if (!moduleFile) {
			return;
		}

		analyzeModule(new FilePath(moduleFile), analysis);
	});
}

function analyzePackage(
	pkgDir: FilePath,
	analysis: Analysis
): PackageDescriptor {
	if (analysis.packages[pkgDir.asNative]) {
		return analysis.packages[pkgDir.asNative];
	}

	const pkgJson = require(pkgDir.join('package.json').asNative);

	analysis.packages[pkgDir.asNative] = {
		name: pkgJson.name,
		version: pkgJson.version,
		entryPoint: {
			cjs: getEntryPoint(pkgDir, 'cjs'),
			esm: getEntryPoint(pkgDir, 'esm'),
		},
	};

	return analysis.packages[pkgDir.asNative];
}

function findPackageDir(moduleFile: FilePath): FilePath {
	let dir: FilePath;

	for (
		dir = moduleFile.dirname();
		dir.dirname().asNative !== dir.asNative;
		dir = dir.dirname()
	) {
		try {
			const pkgJson = require(dir.join('package.json').asNative);

			if (pkgJson.name && pkgJson.version) {
				break;
			}
		}
		catch (error) {}
	}

	if (!fs.existsSync(dir.join('package.json').asNative)) {
		throw new Error(
			`File ${moduleFile.asNative} does not belong to any npm package`
		);
	}

	return dir;
}
