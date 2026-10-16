/* The answers Safari shows above the suggestions: arithmetic and unit
   conversions. A hand-written parser rather than eval() — the input is whatever
   was typed into a search box, and names are looked up in Maps so things like
   "constructor" can never reach an object prototype. */

const FUNCS = new Map([
  ["sqrt", Math.sqrt], ["cbrt", Math.cbrt], ["abs", Math.abs], ["exp", Math.exp],
  ["sin", Math.sin], ["cos", Math.cos], ["tan", Math.tan],
  ["asin", Math.asin], ["acos", Math.acos], ["atan", Math.atan],
  ["log", Math.log10], ["ln", Math.log], ["log2", Math.log2],
  ["round", Math.round], ["floor", Math.floor], ["ceil", Math.ceil],
]);
const CONSTS = new Map([["pi", Math.PI], ["π", Math.PI], ["e", Math.E], ["tau", 2 * Math.PI]]);
const OPS = { "×": "*", "·": "*", "÷": "/", "−": "-", "–": "-" };
const MAX_FACTORIAL = 170;

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    const num = src.slice(i).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (num) { out.push({ t: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    const word = src.slice(i).match(/^(?:[a-z]+\d?|π)/i);
    if (word) { out.push({ t: "id", v: word[0].toLowerCase() }); i += word[0].length; continue; }
    const op = OPS[ch] || ch;
    if ("+-*/^%!(),".includes(op)) { out.push({ t: "op", v: op }); i++; continue; }
    return null;
  }
  return out;
}

/* Precedence climbing. `ops` counts real operations so answer() can tell
   "2+2" (maths) from "42" or "pi" (just a value — not worth a row). */
function parse(tokens) {
  let pos = 0;
  let ops = 0;
  const peek = () => tokens[pos];
  const isOp = (v) => peek()?.t === "op" && peek().v === v;
  const fail = () => { throw new SyntaxError("bad expression"); };

  const expr = () => {
    let v = term();
    while (isOp("+") || isOp("-")) {
      const op = tokens[pos++].v;
      const r = term();
      v = op === "+" ? v + r : v - r;
      ops++;
    }
    return v;
  };

  const term = () => {
    let v = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = tokens[pos++].v;
        const r = unary();
        v = op === "*" ? v * r : v / r;
      } else if (peek()?.t === "id" && peek().v === "mod") {
        pos++;
        v %= unary();
      } else if (isOp("(") || peek()?.t === "id") {
        v *= unary(); // implicit: "2(3+1)", "2pi"
      } else {
        return v;
      }
      ops++;
    }
  };

  const unary = () => {
    if (isOp("-")) { pos++; return -unary(); }
    if (isOp("+")) { pos++; return unary(); }
    return power();
  };

  const power = () => {
    const base = postfix();
    if (!isOp("^")) return base;
    pos++;
    ops++;
    return base ** unary();
  };

  const postfix = () => {
    let v = primary();
    while (isOp("%") || isOp("!")) {
      const op = tokens[pos++].v;
      v = op === "%" ? v / 100 : factorial(v);
      ops++;
    }
    return v;
  };

  const primary = () => {
    const tok = tokens[pos++];
    if (!tok) fail();
    if (tok.t === "num") return tok.v;
    if (tok.t === "op" && tok.v === "(") {
      const v = expr();
      if (!isOp(")")) fail();
      pos++;
      return v;
    }
    if (tok.t === "id") {
      if (CONSTS.has(tok.v)) return CONSTS.get(tok.v);
      if (FUNCS.has(tok.v) && isOp("(")) {
        pos++;
        const arg = expr();
        if (!isOp(")")) fail();
        pos++;
        ops++;
        return FUNCS.get(tok.v)(arg);
      }
    }
    return fail();
  };

  const value = expr();
  if (pos !== tokens.length) fail();
  return { value, ops };
}

function factorial(n) {
  if (!Number.isInteger(n) || n < 0 || n > MAX_FACTORIAL) return NaN;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function run(src) {
  const tokens = tokenize(String(src ?? ""));
  if (!tokens?.length) return null;
  try {
    const out = parse(tokens);
    return Number.isFinite(out.value) ? out : null;
  } catch {
    return null;
  }
}

/** @param {string} src @returns {number | null} */
export function evaluate(src) {
  const out = run(src);
  return out ? clean(out.value) : null;
}

/* Floating-point noise ("0.30000000000000004") never reaches the screen. */
const clean = (v) => {
  const n = Number(v.toPrecision(12));
  return Object.is(n, -0) ? 0 : n;
};

/** @param {number} v */
export function formatNumber(v) {
  const n = Number(v.toPrecision(10));
  if (Object.is(n, -0) || n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-6) return String(n);
  return n.toLocaleString("en-US", { maximumFractionDigits: 10 });
}

/* ── Units ─────────────────────────────────────────────────── */

const UNIT_TABLE = [
  ["length", "mm", 0.001, ["mm", "millimeter", "millimeters"]],
  ["length", "cm", 0.01, ["cm", "centimeter", "centimeters"]],
  ["length", "m", 1, ["m", "meter", "meters", "metre", "metres"]],
  ["length", "km", 1000, ["km", "kilometer", "kilometers", "kilometre", "kilometres"]],
  ["length", "in", 0.0254, ["in", "inch", "inches", '"']],
  ["length", "ft", 0.3048, ["ft", "foot", "feet", "'"]],
  ["length", "yd", 0.9144, ["yd", "yard", "yards"]],
  ["length", "mi", 1609.344, ["mi", "mile", "miles"]],
  ["mass", "mg", 1e-6, ["mg"]],
  ["mass", "g", 0.001, ["g", "gram", "grams"]],
  ["mass", "kg", 1, ["kg", "kilo", "kilos", "kilogram", "kilograms"]],
  ["mass", "oz", 0.028349523125, ["oz", "ounce", "ounces"]],
  ["mass", "lb", 0.45359237, ["lb", "lbs", "pound", "pounds"]],
  ["volume", "ml", 0.001, ["ml", "milliliter", "milliliters"]],
  ["volume", "L", 1, ["l", "liter", "liters", "litre", "litres"]],
  ["volume", "gal", 3.785411784, ["gal", "gallon", "gallons"]],
  ["volume", "cup", 0.2365882365, ["cup", "cups"]],
  ["volume", "fl oz", 0.0295735295625, ["floz", "fl oz"]],
  ["speed", "km/h", 1 / 3.6, ["km/h", "kmh", "kph"]],
  ["speed", "mph", 0.44704, ["mph"]],
  ["speed", "m/s", 1, ["m/s"]],
  ["speed", "kn", 0.514444, ["kn", "knot", "knots"]],
  ["temp", "°C", "C", ["c", "°c", "celsius"]],
  ["temp", "°F", "F", ["f", "°f", "fahrenheit"]],
  ["temp", "K", "K", ["k", "kelvin"]],
];

const UNITS = new Map(
  UNIT_TABLE.flatMap(([dim, label, factor, names]) =>
    names.map((n) => [n, { dim, label, factor }]))
);

const toKelvin = { C: (v) => v + 273.15, F: (v) => (v - 32) * 5 / 9 + 273.15, K: (v) => v };
const fromKelvin = { C: (v) => v - 273.15, F: (v) => (v - 273.15) * 9 / 5 + 32, K: (v) => v };

const CONVERSION = /^(-?(?:\d+\.?\d*|\.\d+))\s*([a-z°"'/]+(?: oz)?)\s+(?:to|in|as|->|→)\s+([a-z°"'/]+(?: oz)?)$/i;

/** @param {string} src @returns {{ value: number, unit: string } | null} */
export function convert(src) {
  const m = String(src ?? "").trim().match(CONVERSION);
  if (!m) return null;
  const from = UNITS.get(m[2].toLowerCase());
  const to = UNITS.get(m[3].toLowerCase());
  if (!from || !to || from.dim !== to.dim) return null;
  const v = Number(m[1]);
  const value = from.dim === "temp"
    ? fromKelvin[to.factor](toKelvin[from.factor](v))
    : (v * from.factor) / to.factor;
  return Number.isFinite(value) ? { value: clean(value), unit: to.label } : null;
}

/* Dates and phone numbers are made of digits and dashes too — "2026-10-15"
   is not a subtraction anybody wants answered. */
const NOT_MATHS = /^\d{2,4}[-/.]\d{1,2}[-/.]\d{1,4}$|^\d+(?:-\d+){2,}$/;

/**
 * The answer row for `raw`, or null when it is not a calculation.
 * @param {string} raw
 * @returns {{ text: string, value: number, kind: "calc" | "convert" } | null}
 */
export function answer(raw) {
  let s = String(raw ?? "").trim();
  if (s.startsWith("=")) s = s.slice(1).trim();
  if (!s || NOT_MATHS.test(s)) return null;

  const conv = convert(s);
  if (conv) return { text: `${formatNumber(conv.value)} ${conv.unit}`, value: conv.value, kind: "convert" };

  const out = run(s);
  if (!out || out.ops === 0) return null;
  const value = clean(out.value);
  return { text: formatNumber(value), value, kind: "calc" };
}
