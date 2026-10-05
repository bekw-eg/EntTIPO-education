import type { LocalVerdict, OfflineStep } from "./types";

/** Deterministic finite decimals and simple fractions only; never eval an expression. */
export function simpleNumber(input: string): number | null {
  const value = input.trim().replace(",", ".");
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  const parts = value.split("/").map(part => part.trim());
  if (parts.length > 2 || parts.some(part => !decimal.test(part))) return null;
  const numbers = parts.map(Number);
  if (numbers.some(n => !Number.isFinite(n) || Math.abs(n) > 1e12)) return null;
  if (parts.length === 2 && numbers[1] === 0) return null;
  return parts.length === 1 ? numbers[0] : numbers[0] / numbers[1];
}

export function gradeLocal(step: OfflineStep, answer: string): LocalVerdict {
  if (!step.localKey) return "pending";
  if (step.localKey.kind === "choice") {
    if (!step.options.some(option => option.id === answer)) return "pending";
    return answer === step.localKey.value ? "correct" : "incorrect";
  }
  if (step.localKey.kind === "select") {
    try {
      const values: unknown = JSON.parse(answer);
      const expected: string[] = JSON.parse(step.localKey.value);
      if (!Array.isArray(values) || values.some(v => typeof v !== "string" || !step.options.some(o => o.id === v))) return "pending";
      if (new Set(values).size !== values.length) return "pending";
      const unique = [...new Set(values)].sort();
      return JSON.stringify(unique) === JSON.stringify([...expected].sort()) ? "correct" : "incorrect";
    } catch { return "pending"; }
  }
  const actual = simpleNumber(answer), expected = simpleNumber(step.localKey.value);
  // Symbolic numeric input (sqrt, pi, powers, etc.) is deferred, never marked wrong.
  if (actual === null || expected === null) return "pending";
  return Math.abs(actual - expected) <= 1e-9 ? "correct" : "incorrect";
}
