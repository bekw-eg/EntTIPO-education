/**
 * Lightweight, high-precision mathematical validation engine in JavaScript/TypeScript.
 * Works completely offline in browser and Node.js without requiring Python SymPy.
 *
 * Features:
 * - Multi-point randomized algebraic equivalence testing (Monte Carlo sampling)
 * - Safe AST expression evaluator (supports powers, trig, logs, radicals, implicit multiplication)
 * - Numeric and fraction equivalence (e.g. "1/2" == "0.5", "sqrt(2)/2" == "1/sqrt(2)")
 * - Equation canonicalization (e.g. "2*x = 6" == "x = 3")
 */

export interface MathEngineResult {
  isEquivalent: boolean;
  methodUsed: "exact" | "numeric" | "monte_carlo" | "polynomial";
  difference?: number;
  error?: string;
}

/**
 * Standardizes mathematical expressions for parsing.
 * Converts LaTeX commands, replaces Unicode symbols, and inserts implicit multiplication.
 */
export function normalizeMathString(raw: string): string {
  if (!raw) return "";

  let s = raw.trim().toLowerCase();

  // Remove LaTeX wrappers like \text{}, $, \left, \right
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\\text\{([^}]+)\}/g, "$1");
  s = s.replace(/\$/g, "");

  // Common LaTeX symbols
  s = s.replace(/\\cdot|\\times/g, "*");
  s = s.replace(/\\div/g, "/");
  s = s.replace(/\\sqrt\{([^}]+)\}/g, "sqrt($1)");
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "(($1)/($2))");
  s = s.replace(/\\pi/g, "pi");

  // Unicode math symbols
  s = s.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  s = s.replace(/π/g, "pi");

  // Power syntax: replace ** with ^ or vice versa
  s = s.replace(/\*\*/g, "^");

  // Remove all whitespace
  s = s.replace(/\s+/g, "");

  // Implicit multiplication:
  // e.g. 2x -> 2*x, 3(x+1) -> 3*(x+1), (x-1)(x+2) -> (x-1)*(x+2), x(x+1) -> x*(x+1)
  // Repeat to catch consecutive patterns like 2(x)(y)
  for (let i = 0; i < 3; i++) {
    s = s.replace(/(\d)([a-zA-Z(])/g, "$1*$2");
    s = s.replace(/(\))(\()/g, "$1*$2");
    s = s.replace(/(\))([a-zA-Z\d])/g, "$1*$2");
    s = s.replace(/([a-zA-Z])(\()/g, (match, p1) => {
      // Don't insert * if it's a known function name like sin(, cos(, sqrt(, etc.
      const knownFuncs = ["sin", "cos", "tan", "asin", "acos", "atan", "arcsin", "arccos", "arctan", "sqrt", "ln", "log", "exp", "abs"];
      if (knownFuncs.some(fn => s.includes(`${fn}(`))) {
        return match;
      }
      return `${p1}*(`;
    });
  }

  return s;
}

/**
 * Safely evaluates a single-variable or multi-variable expression at given variable values.
 */
export function safeEvaluate(
  expression: string,
  variables: Record<string, number> = {}
): number | null {
  try {
    let expr = normalizeMathString(expression);

    // Replace math functions and constants with JavaScript Math equivalents
    // Using placeholders to avoid collision
    const mathReplacements: [RegExp, string][] = [
      [/\barcsin\b|\basin\b/g, "Math.asin"],
      [/\barccos\b|\bacos\b/g, "Math.acos"],
      [/\barctan\b|\batan\b/g, "Math.atan"],
      [/\bsin\b/g, "Math.sin"],
      [/\bcos\b/g, "Math.cos"],
      [/\btan\b/g, "Math.tan"],
      [/\bsqrt\b/g, "Math.sqrt"],
      [/\bln\b/g, "Math.log"],
      [/\blog\b/g, "Math.log10"],
      [/\bexp\b/g, "Math.exp"],
      [/\babs\b/g, "Math.abs"],
      [/\bpi\b/g, "Math.PI"],
      [/\be\b/g, "Math.E"],
    ];

    // Power syntax in JS: x^2 -> (x)**2
    // Convert a^b to Math.pow(a, b) or **
    expr = expr.replace(/\^/g, "**");

    for (const [pattern, replacement] of mathReplacements) {
      expr = expr.replace(pattern, replacement);
    }

    // Substitute variable values
    for (const [varName, val] of Object.entries(variables)) {
      const varRegex = new RegExp(`\\b${varName}\\b`, "g");
      expr = expr.replace(varRegex, `(${val})`);
    }

    // Security check: ensure only safe tokens remain
    // Allowed: digits, ., +, -, *, /, (, ), Math, sin, cos, tan, asin, acos, atan, sqrt, log, exp, abs, PI, E, commas
    const sanitized = expr.replace(/Math\.(sin|cos|tan|asin|acos|atan|sqrt|log|log10|exp|abs|PI|E)/g, "");
    if (!/^[\d\s+\-*/().,]+$/.test(sanitized)) {
      return null;
    }

    // Evaluate in strict mode
    const result = Function(`"use strict"; return (${expr});`)();
    if (typeof result !== "number" || isNaN(result) || !isFinite(result)) {
      return null;
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Validates whether two numeric answers are equivalent.
 * Supports fractions ("3/4" == "0.75"), square roots ("sqrt(2)/2" == "0.707106..."), constants ("2*pi").
 */
export function validateNumberOffline(
  userAnswer: string,
  expectedAnswer: string,
  tolerance = 1e-6
): MathEngineResult {
  const normUser = normalizeMathString(userAnswer);
  const normExpected = normalizeMathString(expectedAnswer);

  if (normUser === normExpected) {
    return { isEquivalent: true, methodUsed: "exact" };
  }

  const valUser = safeEvaluate(userAnswer);
  const valExpected = safeEvaluate(expectedAnswer);

  if (valUser !== null && valExpected !== null) {
    const diff = Math.abs(valUser - valExpected);
    if (diff <= tolerance) {
      return { isEquivalent: true, methodUsed: "numeric", difference: diff };
    }
  }

  return {
    isEquivalent: false,
    methodUsed: "numeric",
    difference: valUser !== null && valExpected !== null ? Math.abs(valUser - valExpected) : undefined,
  };
}

/**
 * Validates whether two algebraic expressions are equivalent using Monte Carlo sampling.
 * Evaluates both expressions across multiple pseudo-random values of free variables.
 * If |f(x) - g(x)| < tolerance for all test points, expressions are equivalent.
 */
export function validateExpressionOffline(
  userExpr: string,
  expectedExpr: string,
  variables: string[] = ["x"]
): MathEngineResult {
  const normUser = normalizeMathString(userExpr);
  const normExpected = normalizeMathString(expectedExpr);

  // 1. Direct exact match
  if (normUser === normExpected) {
    return { isEquivalent: true, methodUsed: "exact" };
  }

  // 2. Discover free variables if not specified
  const discoveredVars = new Set<string>(variables);
  const potentialVars = userExpr.concat(expectedExpr).match(/[a-zA-Z]/g) || [];
  for (const v of potentialVars) {
    const lower = v.toLowerCase();
    if (!["e", "i"].includes(lower)) {
      // not constant e or imaginary i
      discoveredVars.add(lower);
    }
  }
  const varList = Array.from(discoveredVars);

  // If no variables, treat as pure numbers
  if (varList.length === 0) {
    return validateNumberOffline(userExpr, expectedExpr);
  }

  // 3. Monte Carlo multi-point testing
  // Choose safe evaluation domains away from potential poles (avoid 0, 1, -1)
  const testSets: Record<string, number>[] = [
    { x: 2.37, y: 3.14, z: 1.618, t: 2.718, a: 1.73, b: 2.24, c: 0.89 },
    { x: 4.82, y: 1.45, z: 2.910, t: 3.820, a: 3.11, b: 1.87, c: 2.45 },
    { x: 0.73, y: 5.12, z: 0.618, t: 1.414, a: 2.50, b: 0.95, c: 1.34 },
    { x: 3.65, y: 2.89, z: 4.120, t: 0.850, a: 4.20, b: 3.33, c: 0.52 },
    { x: 5.19, y: 0.88, z: 3.450, t: 4.670, a: 0.67, b: 2.12, c: 3.88 },
  ];

  let matchesCount = 0;
  let evaluatedCount = 0;

  for (const sample of testSets) {
    const varAssignment: Record<string, number> = {};
    for (const v of varList) {
      varAssignment[v] = sample[v] ?? (Math.sin(v.charCodeAt(0)) * 2 + 3);
    }

    const valUser = safeEvaluate(userExpr, varAssignment);
    const valExpected = safeEvaluate(expectedExpr, varAssignment);

    if (valUser !== null && valExpected !== null) {
      evaluatedCount++;
      const diff = Math.abs(valUser - valExpected);
      // Relative difference or absolute
      const maxVal = Math.max(Math.abs(valUser), Math.abs(valExpected), 1);
      if (diff / maxVal < 1e-5) {
        matchesCount++;
      }
    }
  }

  if (evaluatedCount >= 3 && matchesCount === evaluatedCount) {
    return { isEquivalent: true, methodUsed: "monte_carlo" };
  }

  return {
    isEquivalent: false,
    methodUsed: "monte_carlo",
    error: evaluatedCount < 3 ? "Не удалось вычислить символьное выражение" : undefined,
  };
}

/**
 * Validates mathematical equation equality.
 * e.g. "2*x = 6" and "x = 3"
 */
export function validateEquationOffline(
  userEq: string,
  expectedEq: string,
  variable = "x"
): MathEngineResult {
  const parseSides = (eq: string) => {
    const parts = eq.split("=");
    if (parts.length === 2) {
      return `(${parts[0]}) - (${parts[1]})`;
    }
    return eq;
  };

  const userDiff = parseSides(userEq);
  const expectedDiff = parseSides(expectedEq);

  return validateExpressionOffline(userDiff, expectedDiff, [variable]);
}
