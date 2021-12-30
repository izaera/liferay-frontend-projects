/**
 * SPDX-FileCopyrightText: © 2021 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import fs from 'fs';
import WebpackError from 'webpack/lib/WebpackError';

export interface ExplainedErrorOptions {
	filePath?: string;
	sourceCode?: string;
}

export default class ExplainedError extends Error {
	static CONTEXT_LINES = 5;

	constructor(error: Error, options: ExplainedErrorOptions = {}) {
		super();

		this._error = error;
		this._explanation = this._explainError(error, options);
	}

	public toString(): string {
		return this._explanation;
	}

	private _explainError(
		error: Error,
		options: ExplainedErrorOptions
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
				try {
					sourceCode = fs.readFileSync(filePath, 'utf8');
				}
				catch (error) {
					sourceCode = '<no source code available>';
				}
			}
		}
		else {
			filePath = '<unknown file>';
		}

		const contextLines =
			sourceCode && line ? this._getContextLines(sourceCode, line) : '';

		return `${error.toString()}${contextLines}\n...at ${filePath}`;
	}

	private _getContextLines(sourceCode: string, aroundLine: number): string {
		const lines = sourceCode.toString().split('\n');

		const beginLine = Math.max(
			1,
			aroundLine - ExplainedError.CONTEXT_LINES
		);
		const endLine = Math.min(
			aroundLine + ExplainedError.CONTEXT_LINES,
			lines.length
		);

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

	readonly _error: Error;
	readonly _explanation: string;
}
