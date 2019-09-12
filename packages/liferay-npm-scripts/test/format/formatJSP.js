/**
 * © 2019 Liferay, Inc. <https://liferay.com>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

const formatJSP = require('../../src/format/formatJSP');
const getFixture = require('../../support/getFixture');

describe('formatJSP()', () => {
	it('deals with interleaved JS control structures and JSP tags', () => {
		// eg. an `if()` that is conditionally added augmented with an `else()`
		// based on a tag.
		const source = `
			<p>Hi!</p>
			<script>
				if (richEditor.getEditor().getSession().getUndoManager().hasUndo()) {
					Liferay.fire('<portlet:namespace />saveTemplate');
				}
				<c:if test="<%= template == null %>">
					else {
						editorContentElement.val(STR_EMPTY);
					}
				</c:if>
			</script>
		`;

		// Note that Prettier keeps the `else()` in the right place due to
		// special casing in the notes in the tagReplacements() implementation.
		expect(formatJSP(source)).toBe(`
			<p>Hi!</p>
			<script>
				if (
					richEditor
						.getEditor()
						.getSession()
						.getUndoManager()
						.hasUndo()
				) {
					Liferay.fire('<portlet:namespace />saveTemplate');
				}
				<c:if test="<%= template == null %>">
					else {
						editorContentElement.val(STR_EMPTY);
					}
				</c:if>
			</script>
		`);
	});

	it('pads input so that Prettier syntax errors have accurate line numbers', () => {
		const source = `
			<p>Hi!</p>

			<p>Some content.</p>

			<p>Some more content.</p>

			<p>Even more content.</p>

			<script>
				if (success()) {
					Liferay.fire('success');
				} else
					alert('Error!');

					// Without padding, Prettier would report an error on the
					// following line as having happened at (8:1).
				}
			</script>
		`;

		expect(() => formatJSP(source)).toThrow(/Unexpected token \(17:1\)/);
	});

	it('passes the blinking light test (configuration.jsp)', async () => {
		const source = await getFixture('format/configuration.jsp');

		expect(formatJSP(source)).toMatchSnapshot();
	});

	it('passes the blinking light test (edit_template_display.jspf)', async () => {
		const source = await getFixture('format/edit_template_display.jspf');

		expect(formatJSP(source)).toMatchSnapshot();
	});

	it('passes the blinking light test (page.jsp)', async () => {
		const source = await getFixture('format/page.jsp');

		expect(formatJSP(source)).toMatchSnapshot();
	});

	it('passes the blinking light test (view_calendar_menus.jspf)', async () => {
		const source = await getFixture('format/view_calendar_menus.jspf');

		expect(formatJSP(source)).toMatchSnapshot();
	});
});
