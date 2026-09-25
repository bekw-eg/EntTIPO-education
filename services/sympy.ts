/**
 * SymPy FastAPI client service.
 * Handles communication with the Python math validation microservice.
 */

const MATH_SERVICE_URL =
  process.env.MATH_SERVICE_URL ?? "http://localhost:8001";

export interface ValidationResult {
  isEquivalent: boolean;
  error?: string;
}

/**
 * Validate that two mathematical expressions are equivalent using SymPy.
 * e.g. "x + x" == "2*x" → true
 */
export async function validateExpression(
  userExpression: string,
  expectedExpression: string,
  variables: string[] = []
): Promise<ValidationResult> {
  try {
    const response = await fetch(`${MATH_SERVICE_URL}/validate-expression`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userExpression,
        expectedExpression,
        variables,
      }),
      // Don't let math service slow down the app
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error("Math service error:", response.status);
      return fallbackExpressionValidation(userExpression, expectedExpression);
    }

    return await response.json();
  } catch (error) {
    console.error("Math service unreachable:", error);
    // Fallback to simple string comparison if service is down
    return fallbackExpressionValidation(userExpression, expectedExpression);
  }
}

/**
 * Validate a numeric answer.
 * Handles fractions like "8/3", special values like "pi"
 */
export async function validateNumber(
  userAnswer: string,
  expectedAnswer: string,
  tolerance = 1e-9
): Promise<ValidationResult> {
  try {
    const response = await fetch(`${MATH_SERVICE_URL}/validate-number`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAnswer, expectedAnswer, tolerance }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return fallbackNumberValidation(userAnswer, expectedAnswer, tolerance);
    }

    return await response.json();
  } catch (error) {
    console.error("Math service unreachable:", error);
    return fallbackNumberValidation(userAnswer, expectedAnswer, tolerance);
  }
}

/**
 * Validate an equation.
 */
export async function validateEquation(
  userEquation: string,
  expectedEquation: string,
  variable = "x"
): Promise<ValidationResult> {
  try {
    const response = await fetch(`${MATH_SERVICE_URL}/validate-equation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEquation, expectedEquation, variable }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { isEquivalent: false, error: "Validation service error" };
    }

    return await response.json();
  } catch (error) {
    console.error("Math service unreachable:", error);
    return fallbackExpressionValidation(userEquation, expectedEquation);
  }
}

/**
 * Check math service health.
 */
export async function checkMathServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${MATH_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

import {
  validateExpressionOffline,
  validateNumberOffline,
  validateEquationOffline,
} from "@/lib/mathEngine";

// ─── Fallback validators (when Python service is down) ───────────────────────

function fallbackExpressionValidation(
  user: string,
  expected: string,
  variables: string[] = ["x"]
): ValidationResult {
  const result = validateExpressionOffline(user, expected, variables);
  return {
    isEquivalent: result.isEquivalent,
    error: result.isEquivalent
      ? undefined
      : result.error ?? "JS Математический движок: выражения не эквивалентны",
  };
}

function fallbackNumberValidation(
  user: string,
  expected: string,
  tolerance: number
): ValidationResult {
  const result = validateNumberOffline(user, expected, tolerance);
  return {
    isEquivalent: result.isEquivalent,
    error: result.isEquivalent
      ? undefined
      : result.error ?? "JS Математический движок: числа не равны",
  };
}

