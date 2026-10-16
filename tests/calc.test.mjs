import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, answer, convert, formatNumber } from "../js/search/calc.js";

test("arithmetic follows normal precedence", () => {
  assert.equal(evaluate("2+2"), 4);
  assert.equal(evaluate("2 + 3 * 4"), 14);
  assert.equal(evaluate("(2+3)*4"), 20);
  assert.equal(evaluate("2^10"), 1024);
  assert.equal(evaluate("2^3^2"), 512);
  assert.equal(evaluate("-3^2"), -9);
  assert.equal(evaluate("10/4"), 2.5);
  assert.equal(evaluate("1e3+1"), 1001);
  assert.equal(evaluate(".5*4"), 2);
});

test("typographic operators and implicit multiplication", () => {
  assert.equal(evaluate("2×3"), 6);
  assert.equal(evaluate("6÷4"), 1.5);
  assert.equal(evaluate("3−1"), 2);
  assert.equal(evaluate("2(3+1)"), 8);
  assert.ok(Math.abs(evaluate("2pi") - 2 * Math.PI) < 1e-9);
});

test("percent, modulo, factorial, functions and constants", () => {
  assert.equal(evaluate("50%"), 0.5);
  assert.equal(evaluate("200*15%"), 30);
  assert.equal(evaluate("7 mod 3"), 1);
  assert.equal(evaluate("5!"), 120);
  assert.equal(evaluate("sqrt(16)"), 4);
  assert.equal(evaluate("abs(-2)"), 2);
  assert.equal(evaluate("sin(0)"), 0);
  assert.equal(evaluate("log(1000)"), 3);
  assert.equal(evaluate("ln(e)"), 1);
});

test("invalid or unsafe input yields null", () => {
  for (const s of ["", "2+", "hello", "alert(1)", "constructor", "1/0", "(2", "2)", "sqrt", "2..3", "__proto__", "171!"]) {
    assert.equal(evaluate(s), null, s);
  }
});

test("answer only fires for things that are actually maths", () => {
  assert.equal(answer("42"), null);
  assert.equal(answer("e"), null);
  assert.equal(answer("pi"), null);
  assert.equal(answer("hello world"), null);
  assert.equal(answer("2+2")?.text, "4");
  assert.equal(answer("= 2+2")?.text, "4");
  assert.equal(answer("1/3")?.text, "0.3333333333");
});

test("unit conversions", () => {
  assert.equal(answer("10 km to mi")?.text, "6.213711922 mi");
  assert.equal(answer("100 f to c")?.text, "37.77777778 °C");
  assert.equal(answer("0 °C in °F")?.text, "32 °F");
  assert.equal(answer("5 kg in lb")?.text, "11.02311311 lb");
  assert.equal(answer("1 ft to cm")?.text, "30.48 cm");
  assert.equal(convert("3 apples to oranges"), null);
  assert.equal(convert("3 kg to km"), null);
});

test("numbers format compactly", () => {
  assert.equal(formatNumber(1 / 3), "0.3333333333");
  assert.equal(formatNumber(1e21), "1e+21");
  assert.equal(formatNumber(0.1 + 0.2), "0.3");
  assert.equal(formatNumber(1234567), "1,234,567");
  assert.equal(formatNumber(-0), "0");
});
