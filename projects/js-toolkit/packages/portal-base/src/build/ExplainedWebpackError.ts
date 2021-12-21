/**
 * SPDX-FileCopyrightText: © 2020 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import fs from 'fs';
import WebpackError from 'webpack/lib/WebpackError';

const CONTEXT_LINES = 5;

interface ExplainedWebpackErrorOptions {
	filePath?: string;
	sourceCode?: string;
}

export default class ExplainedWebpackError extends Error {
	constructor(error: Error, options: ExplainedWebpackErrorOptions = {}) {
		super();

		this._error = error;
		this._explanation = explainError(error, options);
	}

	public toString(): string {
		return this._explanation;
	}

	readonly _error: Error;
	readonly _explanation: string;
}

function getContextLines(sourceCode: string, aroundLine: number): string {
	const lines = sourceCode.toString().split('\n');

	const beginLine = Math.max(1, aroundLine - CONTEXT_LINES);
	const endLine = Math.min(aroundLine + CONTEXT_LINES, lines.length);

	const padMinChars = beginLine.toString().length;

	return `

${lines
	.slice(beginLine - 1, endLine)
	.map((line, i) => {
		i += beginLine;

		const errorMarker = i === aroundLine ? '>' : ' ';
		const lineNumber = i.toString().padStart(padMinChars);

		return `${errorMarker} ${lineNumber}: ${line}`;
	})
	.join('\n')}
`;
}

function explainError(
	error: Error,
	options: ExplainedWebpackErrorOptions
): string {
	let filePath = options.filePath;
	let sourceCode = options.sourceCode;
	let line: number;

	if (error instanceof WebpackError) {
		filePath = error['module'] && error['module']['userRequest'];
	}
	else if (error instanceof SyntaxError) {
		line = error['loc']['line'];
	}

	if (filePath) {
		if (!sourceCode) {
			sourceCode = fs.readFileSync(filePath).toString();
		}
	}
	else {
		filePath = '<unknown file>';
	}

	const contextLines =
		sourceCode && line ? getContextLines(sourceCode, line) : '';

	return `${error.toString()}${contextLines}\n\n...at ${filePath}`;
}
