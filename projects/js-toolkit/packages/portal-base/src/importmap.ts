/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

/*
import {
	FilePath,
	format,
	isLocalModule,
	joinModuleName,
	splitModuleName,
} from '@liferay/js-toolkit-core';
import {Parser} from 'acorn';
import acornJsx from 'acorn-jsx';
import type {Program} from 'estree';
import fs from 'fs';
import project from 'liferay-npm-build-tools-common/lib/project';
import resolve from 'resolve';

import getEntryPoint from './util/getEntryPoint';
import readImportmapJson, {ImportmapJson} from './util/readImportmapJson';

const {fail, print, question, success, warn} = format;

type ImportType = 'cjs' | 'esm' | 'missing';

interface Imports {
	bare: {
		[source: string]: ImportType;
	};
	visited: {
		[source: string]: true;
	};
}

const prjDir = new FilePath(project.dir.asNative);

export default async function importmap(): Promise<void> {
	const entryPoint = getEntryPoint(prjDir, 'esm');

	const imports = getImports(
		prjDir.join(new FilePath(entryPoint, {posix: true}))
	);

	const importmap = readImportmapJson(prjDir);

	for (const [bareIdentifier, type] of Object.entries(imports.bare)) {
		if (importmap[bareIdentifier]) {
			checkImportmapUri(bareIdentifier, type, importmap[bareIdentifier]);
		}
		else {
			addImportmapUri(importmap, bareIdentifier, type);
		}
	}

	console.log(importmap);

	//print(success`Bundle {${outputFile}} deployed to {${deployPath}}`);

}

function addImportmapUri(
	importmap: ImportmapJson,
	bareIdentifier: string,
	type: ImportType
): void {
	let validUris: string[];

	switch (type) {
		case 'esm':
			validUris = [`local:${bareIdentifier}`, `provided:`];
			break;

		case 'cjs':
			validUris = [`webpack:${bareIdentifier}`, `provided:`];
			break;

		case 'missing':
			validUris = [`provided:`];
			break;

		default:
			throw new Error(
				`Unsupported type ${type} for bare indentifier ${bareIdentifier}`
			);
	}

	// TODO: let user choose when more than one possible uri is possible

	importmap[bareIdentifier] = validUris[0];
}

function checkImportmapUri(
	bareIdentifier: string,
	type: ImportType,
	uri: string
): void {
	let validSchemes: string[];

	switch (type) {
		case 'esm':
			validSchemes = ['local', 'provided'];
			break;

		case 'cjs':
			validSchemes = ['cjs', 'webpack'];
			break;

		case 'missing':
			validSchemes = ['provided'];
			break;

		default:
			throw new Error(
				`Unsupported type ${type} for bare indentifier ${bareIdentifier}`
			);
	}

	// TODO: move scheme extraction and validation to an utility function

	const scheme = uri.substring(0, uri.indexOf(':'));

	if (!validSchemes.includes(scheme)) {
		print(
			warn`Import {${bareIdentifier}} (of type {${type}}) can only use URI schemes ${validSchemes}`
		);
	}
}

function getImports(
	file: FilePath,
	imports: Imports = {bare: {}, visited: {}}
): Imports {
	file = file.resolve();

	if (imports.visited[file.asNative]) {
		return imports;
	}

	imports.visited[file.asNative] = true;

	const source = fs.readFileSync(file.asNative, 'utf8');

	const JSXParser = Parser.extend(acornJsx());

	const node = JSXParser.parse(source, {
		ecmaVersion: 'latest',
		sourceType: 'module',
	});

	if (node.type !== 'Program') {
		return;
	}

	const program = (node as unknown) as Program;

	for (const node of program.body) {
		if (node.type !== 'ImportDeclaration') {
			break;
		}

		const source = node.source.value as string;

		if (isLocalModule(source)) {
			getImports(
				file.dirname().join(new FilePath(source, {posix: true})),
				imports
			);
		}
		else {
			const parts = splitModuleName(source);

			const pkgJsonModule = joinModuleName(
				parts.scope,
				parts.pkgName,
				'/package.json'
			);

			const pkgDir = new FilePath(
				resolve.sync(pkgJsonModule, {
					basedir: file.dirname().resolve().asNative,
				})
			).dirname();

			const esmEntryPoint = getEntryPoint(pkgDir, 'esm');

			if (esmEntryPoint) {
				imports.bare[source] = 'esm';

				getImports(
					pkgDir.join(new FilePath(esmEntryPoint, {posix: true})),
					imports
				);
			}
			else if (getEntryPoint(pkgDir, 'cjs')) {
				imports.bare[source] = 'cjs';
			}
			else {
				imports.bare[source] = 'missing';
			}
		}
	}

	return imports;
}
*/
