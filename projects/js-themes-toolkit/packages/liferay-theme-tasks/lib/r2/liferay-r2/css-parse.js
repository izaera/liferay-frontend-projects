/**
 * SPDX-FileCopyrightText: © 2017 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: MIT
 */

// http://www.w3.org/TR/CSS21/grammar.html
// https://github.com/visionmedia/css-parse/pull/49#issuecomment-30088027

var commentre = /\/\*[^*]*\*+([^/*][^*]*\*+)*\//g;

module.exports = function (css, options) {
	options = options || {};
	options.position = options.position === false ? false : true;

	/**
	 * Positional.
	 */

	var filename = options.filename || '(unknown)';
	var lineno = 1;
	var column = 1;

	/**
	 * Update lineno and column based on `str`.
	 */

	function updatePosition(str) {
		var lines = str.match(/\n/g);
		if (lines) {
			lineno += lines.length;
		}
		var i = str.lastIndexOf('\n');
		column = ~i ? str.length - i : column + str.length;
	}

	/**
	 * Mark position and patch `node.position`.
	 */

	function position() {
		if (!options.position) {
			return positionNoop;
		}

		var start = {column, line: lineno};

		return function (node) {
			node.position = new Position(start);
			whitespace();

			return node;
		};
	}

	function Position(start) {
		this.start = start;
		this.end = {column, line: lineno};
		this.filename = options.filename;
	}

	/**
	 * Non-enumerable source string.
	 */

	Position.prototype.source = css;

	/**
	 * Return `node`.
	 */

	function positionNoop(node) {
		whitespace();

		return node;
	}

	/**
	 * Error `msg`.
	 */

	function error(msg, start) {
		var errorThrown = new Error(`${filename} (${lineno}:${column}) ${msg}`);
		errorThrown.position = new Position(start);
		errorThrown.filename = filename;
		errorThrown.description = msg;
		throw errorThrown;
	}

	/**
	 * Parse stylesheet.
	 */

	function stylesheet() {
		return {
			stylesheet: {
				rules: rules(),
			},
			type: 'stylesheet',
		};
	}

	/**
	 * Opening brace.
	 */

	function open() {
		return match(/^{\s*/);
	}

	/**
	 * Closing brace.
	 */

	function close() {
		return match(/^}/);
	}

	/**
	 * Parse ruleset.
	 */

	function rules() {
		var node;
		var rules = [];
		whitespace();
		comments(rules);
		while (
			css.length &&
			css.charAt(0) !== '}' &&
			(node = atrule() || rule())
		) {
			rules.push(node);
			comments(rules);
		}

		return rules;
	}

	/**
	 * Match `re` and return captures.
	 */

	function match(re) {
		var m = re.exec(css);
		if (!m) {
			return;
		}
		var str = m[0];
		updatePosition(str);
		css = css.slice(str.length);

		return m;
	}

	/**
	 * Parse whitespace.
	 */

	function whitespace() {
		match(/^\s*/);
	}

	/**
	 * Parse comments;
	 */

	function comments(rules) {
		var c;
		rules = rules || [];
		while ((c = comment())) {
			rules.push(c);
		}

		return rules;
	}

	/**
	 * Parse comment.
	 */

	function comment() {
		var pos = position();
		if ('/' !== css.charAt(0) || '*' !== css.charAt(1)) {
			return;
		}

		var i = 2;
		while (
			null !== css.charAt(i) &&
			('*' !== css.charAt(i) || '/' !== css.charAt(i + 1))
		) {
			++i;
		}
		i += 2;

		var str = css.slice(2, i - 2);
		column += 2;
		updatePosition(str);
		css = css.slice(i);
		column += 2;

		return pos({
			comment: str,
			type: 'comment',
		});
	}

	/**
	 * Parse selector.
	 */

	function selector() {
		var m = match(/^([^{]+)/);
		if (!m) {
			return;
		}

		/* @fix Remove all comments from selectors
		 * http://ostermiller.org/findcomment.html */
		return trim(m[0])
			.replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*\/+/g, '')
			.split(/\s*,\s*/);
	}

	/**
	 * Parse declaration.
	 */

	function declaration() {
		var pos = position();

		// prop

		var prop = match(/^(\*?[-#/*\w]+(\[[0-9a-z_-]+\])?)\s*/);
		if (!prop) {
			return;
		}
		prop = trim(prop[0]);

		// :

		if (!match(/^:\s*/)) {
			return error("property missing ':'");
		}

		// val

		var val = match(/^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^)]*?\)|[^};])+)/);
		if (!val) {
			return error('property missing value');
		}

		var ret = pos({
			property: prop.replace(commentre, ''),
			type: 'declaration',
			value: trim(val[0]).replace(commentre, ''),
		});

		// ;

		match(/^[;\s]*/);

		return ret;
	}

	/**
	 * Parse declarations.
	 */

	function declarations() {
		var decls = [];

		if (!open()) {
			return error("missing '{'");
		}
		comments(decls);

		// declarations

		var decl;
		var rule;
		while ((decl = declaration()) || (rule = expandedatrule())) {
			if (decl) {
				decls.push(decl);
				comments(decls);
			}

			if (rule) {
				comments();
				rule = null;
			}
		}

		if (!close()) {
			return error("missing '}'");
		}

		return decls;
	}

	/**
	 * Parse keyframe.
	 */

	function keyframe() {
		var m;
		var vals = [];
		var pos = position();

		while ((m = match(/^((\d+\.\d+|\.\d+|\d+)%?|[a-z]+)\s*/))) {
			vals.push(m[1]);
			match(/^,\s*/);
		}

		if (!vals.length) {
			return;
		}

		return pos({
			declarations: declarations(),
			type: 'keyframe',
			values: vals,
		});
	}

	/**
	 * Parse keyframes.
	 */

	function atkeyframes() {
		var pos = position();
		var m = match(/^@([-\w]+)?keyframes */);

		if (!m) {
			return;
		}
		var vendor = m[1];

		// identifier

		m = match(/^([-\w]+)\s*/);
		if (!m) {
			return error('@keyframes missing name');
		}
		var name = m[1];

		if (!open()) {
			return error("@keyframes missing '{'");
		}

		var frame;
		var frames = comments();
		while ((frame = keyframe())) {
			frames.push(frame);
			frames = frames.concat(comments());
		}

		if (!close()) {
			return error("@keyframes missing '}'");
		}

		return pos({
			keyframes: frames,
			name,
			type: 'keyframes',
			vendor,
		});
	}

	/**
	 * Parse supports.
	 */

	function atsupports() {
		var pos = position();
		var m = match(/^@supports *([^{]+)/);

		if (!m) {
			return;
		}
		var supports = trim(m[1]);

		if (!open()) {
			return error("@supports missing '{'");
		}

		var style = comments().concat(rules());

		if (!close()) {
			return error("@supports missing '}'");
		}

		return pos({
			rules: style,
			supports,
			type: 'supports',
		});
	}

	/**
	 * Parse host.
	 */

	function athost() {
		var pos = position();
		var m = match(/^@host */);

		if (!m) {
			return;
		}

		if (!open()) {
			return error("@host missing '{'");
		}

		var style = comments().concat(rules());

		if (!close()) {
			return error("@host missing '}'");
		}

		return pos({
			rules: style,
			type: 'host',
		});
	}

	/**
	 * Parse media.
	 */

	function atmedia() {
		var pos = position();
		var m = match(/^@media *([^{]+)/);

		if (!m) {
			return;
		}
		var media = trim(m[1]);

		if (!open()) {
			return error("@media missing '{'");
		}

		var style = comments().concat(rules());

		if (!close()) {
			return error("@media missing '}'");
		}

		return pos({
			media,
			rules: style,
			type: 'media',
		});
	}

	/**
	 * Parse paged media.
	 */

	function atpage() {
		var pos = position();
		var m = match(/^@page */);
		if (!m) {
			return;
		}

		var sel = selector() || [];

		if (!open()) {
			return error("@page missing '{'");
		}
		var decls = comments();

		// declarations

		var decl;
		while ((decl = declaration())) {
			decls.push(decl);
			decls = decls.concat(comments());
		}

		if (!close()) {
			return error("@page missing '}'");
		}

		return pos({
			declarations: decls,
			selectors: sel,
			type: 'page',
		});
	}

	/**
	 * Parse document.
	 */

	function atdocument() {
		var pos = position();
		var m = match(/^@([-\w]+)?document *([^{]+)/);
		if (!m) {
			return;
		}

		var vendor = trim(m[1]);
		var doc = trim(m[2]);

		if (!open()) {
			return error("@document missing '{'");
		}

		var style = comments().concat(rules());

		if (!close()) {
			return error("@document missing '}'");
		}

		return pos({
			document: doc,
			rules: style,
			type: 'document',
			vendor,
		});
	}

	function atviewport() {
		var pos = position();
		var m = match(/^@([-\w]+)?viewport */);

		if (!m) {
			return;
		}
		var vendor = m[1];

		return pos({
			declarations: declarations(),
			type: 'viewport',
			vendor,
		});
	}

	function atfontface() {
		var pos = position();
		var m = match(/^@([-\w]+)?font-face */);

		if (!m) {
			return;
		}

		return pos({
			declarations: declarations(),
			type: 'fontface',
		});
	}

	/**
	 * Parse import
	 */

	function atimport() {
		return _atrule('import');
	}

	/**
	 * Parse charset
	 */

	function atcharset() {
		return _atrule('charset');
	}

	/**
	 * Parse namespace
	 */

	function atnamespace() {
		return _atrule('namespace');
	}

	/**
	 * Parse non-block at-rules
	 */

	function _atrule(name) {
		var pos = position();
		var m = match(
			new RegExp(
				'^@' +
					name +
					' *(?:url\\(([^)]+)\\)|([^;\\n]*))(?: *([^;\\n]*))?;'
			)
		);
		if (!m) {
			return;
		}
		var ret = {type: name};
		ret[name] = trim(m[1]);

		return pos(ret);
	}

	/**
	 * Parse at rule.
	 */

	function atrule() {
		if (css[0] !== '@') {
			return;
		}

		return (
			atkeyframes() ||
			atmedia() ||
			atsupports() ||
			atimport() ||
			atcharset() ||
			atnamespace() ||
			atdocument() ||
			atpage() ||
			athost()
		);
	}

	function expandedatrule() {
		return atrule() || atviewport() || atfontface();
	}

	/**
	 * Parse rule.
	 */

	function rule() {
		var pos = position();
		var sel = selector();

		if (!sel) {
			return error('selector missing');
		}
		comments();

		return pos({
			declarations: declarations(),
			selectors: sel,
			type: 'rule',
		});
	}

	return stylesheet();
};

/**
 * Trim `str`.
 */

function trim(str) {
	return str ? str.replace(/^\s+|\s+$/g, '') : '';
}
