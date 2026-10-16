import { test } from "node:test";
import assert from "node:assert/strict";
import { FONT_5x7, FONT_3x5, FONT_BIG, measure } from "../js/dot/font.js";
import { SPRITES } from "../js/dot/sprites.js";

const fonts = { FONT_5x7, FONT_3x5, FONT_BIG };

for (const [name, font] of Object.entries(fonts)) {
  test(`${name}: every glyph is a clean rectangle of dots`, () => {
    for (const [ch, rows] of Object.entries(font.glyphs)) {
      assert.ok(rows.length >= font.height, `${name} ${ch} too short`);
      assert.ok(rows.length <= font.height + 2, `${name} ${ch} too tall`);
      const w = rows[0].length;
      for (const row of rows) {
        assert.equal(row.length, w, `${name} ${JSON.stringify(ch)} ragged`);
        assert.match(row, /^[#.]+$/, `${name} ${JSON.stringify(ch)} bad chars`);
      }
    }
  });
}

test("5x7 covers digits, both cases and the punctuation the UI prints", () => {
  for (const ch of "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz :.-°%/'!?&+") {
    assert.ok(FONT_5x7.get(ch), `missing ${ch}`);
  }
});

test("big digits and 3x5 cover the clock and labels", () => {
  for (const ch of "0123456789:-° ") assert.ok(FONT_BIG.get(ch), `big ${ch}`);
  for (const ch of "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ%:-./ ") assert.ok(FONT_3x5.get(ch), `3x5 ${ch}`);
});

test("lowercase falls back to uppercase where a font has no lowercase", () => {
  assert.deepEqual(FONT_3x5.get("a"), FONT_3x5.get("A"));
});

test("measure accounts for spacing", () => {
  assert.equal(measure("88", FONT_BIG), 7 + 3 + 7);
  assert.equal(measure("glyph", FONT_5x7), 5 * 5 + 4);
  assert.equal(measure("", FONT_5x7), 0);
});

test("sprites are rectangular", () => {
  for (const [name, rows] of Object.entries(SPRITES)) {
    const w = rows[0].length;
    for (const row of rows) assert.equal(row.length, w, name);
  }
});
