import math
import re
import traceback
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sympy
from sympy import (
    E,
    N,
    oo,
    pi,
    simplify,
    symbols,
    sympify,
    trigsimp,
)
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

app = FastAPI(title="Synaq Math Validation Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Pydantic Models ─────────────────────────────────────────────────────────

class ExpressionRequest(BaseModel):
    userExpression: str
    expectedExpression: str
    variables: Optional[List[str]] = []


class NumberRequest(BaseModel):
    userAnswer: str
    expectedAnswer: str
    tolerance: Optional[float] = 1e-9


class EquationRequest(BaseModel):
    userEquation: str
    expectedEquation: str
    variable: Optional[str] = "x"


class ValidationResponse(BaseModel):
    isEquivalent: bool
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    version: str


# ─── Transformations and Dictionaries ────────────────────────────────────────

# Transformations: include implicit multiplication (e.g. 2x -> 2*x) and convert_xor (x^2 -> x**2)
TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)

COMMON_VARS = ["x", "y", "z", "t", "a", "b", "c", "n"]

# Pre-defined mathematical constants and function aliases
MATH_ALIASES: Dict[str, Any] = {
    "pi": sympy.pi,
    "Pi": sympy.pi,
    "PI": sympy.pi,
    "e": sympy.E,
    "E": sympy.E,
    "oo": sympy.oo,
    "Infinity": sympy.oo,
    "infinity": sympy.oo,
    "I": sympy.I,
    # Trigonometry (including Russian/Kazakh notations)
    "sin": sympy.sin,
    "cos": sympy.cos,
    "tan": sympy.tan,
    "tg": sympy.tan,
    "cot": sympy.cot,
    "ctg": sympy.cot,
    "sec": sympy.sec,
    "csc": sympy.csc,
    "asin": sympy.asin,
    "arcsin": sympy.asin,
    "acos": sympy.acos,
    "arccos": sympy.acos,
    "atan": sympy.atan,
    "arctg": sympy.atan,
    "arctan": sympy.atan,
    "acot": sympy.acot,
    "arcctg": sympy.acot,
    "arccot": sympy.acot,
    "sinh": sympy.sinh,
    "sh": sympy.sinh,
    "cosh": sympy.cosh,
    "ch": sympy.cosh,
    "tanh": sympy.tanh,
    "th": sympy.tanh,
    "coth": sympy.coth,
    "cth": sympy.coth,
    # Powers and roots
    "sqrt": sympy.sqrt,
    "cbrt": sympy.cbrt,
    "exp": sympy.exp,
    "log": sympy.log,
    "ln": sympy.ln,
    "lg": lambda arg: sympy.log(arg, 10),
    "abs": sympy.Abs,
    "Abs": sympy.Abs,
}


def sanitize_input(expr_str: Optional[str]) -> str:
    """
    Clean and normalize user mathematical input.
    Replaces unicode symbols, decimal commas, and excess whitespace.
    """
    if not expr_str:
        return ""
    text = expr_str.strip()
    if not text:
        return ""

    # Replace unicode minuses and dashes with ASCII hyphen
    text = text.replace("\u2212", "-").replace("\u2013", "-").replace("\u2014", "-")

    # Replace unicode multiplication and division signs
    text = text.replace("\u00b7", "*").replace("⋅", "*").replace("×", "*")
    text = text.replace("\u00f7", "/").replace("÷", "/")

    # Replace unicode superscripts with caret
    superscript_map = {
        "⁰": "^0", "¹": "^1", "²": "^2", "³": "^3", "⁴": "^4",
        "⁵": "^5", "⁶": "^6", "⁷": "^7", "⁸": "^8", "⁹": "^9",
    }
    for sup, rep in superscript_map.items():
        text = text.replace(sup, rep)

    # Normalize decimal commas between digits (e.g. 0,5 -> 0.5)
    text = re.sub(r"(\d+),(\d+)", r"\1.\2", text)

    return text.strip()


def build_symbol_dict(variables: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Build symbol mapping table containing common variables (x, y, z, t, a, b, c, n),
    custom variables requested, and standard math aliases.
    """
    local_dict = dict(MATH_ALIASES)

    # Always include common variables
    all_var_names = set(COMMON_VARS)
    explicit_vars = set()
    if variables:
        for v in variables:
            clean_v = v.strip()
            if clean_v:
                all_var_names.add(clean_v)
                explicit_vars.add(clean_v)

    for var_name in all_var_names:
        # If user explicitly specified variable that collides with math alias (like 'e'),
        # make it a symbol instead of the constant
        if var_name in explicit_vars or var_name not in local_dict:
            local_dict[var_name] = symbols(var_name)
        elif var_name in COMMON_VARS and var_name != "e":
            local_dict[var_name] = symbols(var_name)

    return local_dict


def are_expressions_equivalent(user_expr: Any, expected_expr: Any) -> bool:
    """
    Determine if two SymPy expressions are mathematically equivalent.
    Employs simplify, trigsimp, expand, nsimplify, and numerical evaluation.
    """
    # Direct equality check
    if user_expr == expected_expr:
        return True

    diff = user_expr - expected_expr
    if diff == 0:
        return True

    # 1. Main check: sympy.simplify(diff) == 0
    try:
        if simplify(diff) == 0:
            return True
    except Exception:
        pass

    # 2. Fallback: sympy.trigsimp for trigonometric identities (e.g. sin(x)^2 + cos(x)^2 == 1)
    try:
        if trigsimp(diff) == 0:
            return True
    except Exception:
        pass

    # 3. Fallback: expand then simplify (e.g. (x+1)(x-1) == x^2 - 1)
    try:
        if simplify(sympy.expand(diff)) == 0:
            return True
    except Exception:
        pass

    # 4. Fallback: nsimplify (handles rational vs float like 1/2 vs 0.5)
    try:
        if simplify(sympy.nsimplify(diff)) == 0:
            return True
    except Exception:
        pass

    # 5. Fallback: sympy built-in .equals() method
    try:
        if user_expr.equals(expected_expr) is True:
            return True
    except Exception:
        pass

    # 6. Fallback: numerical evaluation for constant expressions without free variables
    try:
        if not diff.free_symbols:
            val = complex(diff.evalf())
            if abs(val) < 1e-9:
                return True
    except Exception:
        pass

    # 7. Fallback: multi-point numerical testing for expressions with variables
    try:
        free_syms = list(diff.free_symbols)
        if free_syms:
            # Deterministic pseudo-random points away from singular points 0 and 1
            test_sets = [
                [0.37, 1.42, 2.89, -0.63, 3.15, -1.27],
                [1.13, -2.47, 0.71, 4.09, -1.82, 2.33],
                [2.51, 0.94, -1.33, -3.21, 0.28, -2.19],
            ]
            all_match = True
            for point_values in test_sets:
                sub_dict = {
                    s: point_values[i % len(point_values)]
                    for i, s in enumerate(free_syms)
                }
                evaluated = complex(diff.subs(sub_dict).evalf())
                if abs(evaluated) > 1e-7:
                    all_match = False
                    break
            if all_match:
                return True
    except Exception:
        pass

    return False


def parse_equation(eq_str: str, local_dict: Dict[str, Any]) -> Any:
    """
    Parse an equation into standard form f(x) where f(x) = 0.
    If '=' is present, parses lhs - rhs.
    If no '=' is present, parses eq_str directly as lhs (assuming = 0).
    """
    eq_str = sanitize_input(eq_str)
    if not eq_str:
        raise ValueError("Equation cannot be empty")

    if "=" in eq_str:
        parts = eq_str.split("=")
        if len(parts) != 2:
            raise ValueError(f"Invalid equation format: expected exactly one '=' sign, got {len(parts) - 1}")
        lhs_part = parts[0].strip()
        rhs_part = parts[1].strip()
        if not lhs_part or not rhs_part:
            raise ValueError("Equation cannot have empty left or right side")

        lhs_expr = parse_expr(lhs_part, local_dict=local_dict, transformations=TRANSFORMATIONS)
        rhs_expr = parse_expr(rhs_part, local_dict=local_dict, transformations=TRANSFORMATIONS)
        return lhs_expr - rhs_expr
    else:
        return parse_expr(eq_str, local_dict=local_dict, transformations=TRANSFORMATIONS)


def extract_and_deduplicate_solutions(sols: Any, var_sym: sympy.Symbol) -> List[Any]:
    """
    Normalize SymPy solve results into a flat list of distinct solutions.
    Handles dicts, lists, tuples, and eliminates duplicate roots.
    """
    if sols is None:
        return []

    raw_list: List[Any] = []
    if isinstance(sols, dict):
        if var_sym in sols:
            raw_list.append(sols[var_sym])
        else:
            raw_list.extend(sols.values())
    elif isinstance(sols, (list, tuple, set)):
        for item in sols:
            if isinstance(item, dict):
                if var_sym in item:
                    raw_list.append(item[var_sym])
                elif item:
                    raw_list.extend(item.values())
            elif isinstance(item, (list, tuple)):
                if len(item) == 1:
                    raw_list.append(item[0])
                else:
                    raw_list.append(item[0])
            else:
                raw_list.append(item)
    else:
        raw_list.append(sols)

    # Deduplicate solutions using equivalence check
    unique_sols: List[Any] = []
    for sol in raw_list:
        if not any(are_expressions_equivalent(sol, u) for u in unique_sols):
            unique_sols.append(sol)

    return unique_sols


def are_solution_sets_equivalent(sols1: List[Any], sols2: List[Any]) -> bool:
    """
    Compare two solution sets regardless of order and representation.
    """
    if len(sols1) != len(sols2):
        return False
    if len(sols1) == 0:
        return True

    matched_indices2 = set()
    for s1 in sols1:
        found = False
        for idx2, s2 in enumerate(sols2):
            if idx2 not in matched_indices2 and are_expressions_equivalent(s1, s2):
                matched_indices2.add(idx2)
                found = True
                break
        if not found:
            return False

    return len(matched_indices2) == len(sols2)


# ─── API Endpoints ───────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """
    Health check endpoint.
    """
    return HealthResponse(status="ok", version="1.0.0")


@app.post("/validate-expression", response_model=ValidationResponse)
def validate_expression(req: ExpressionRequest) -> ValidationResponse:
    """
    Validate that userExpression and expectedExpression are mathematically equivalent.
    """
    user_str = sanitize_input(req.userExpression)
    expected_str = sanitize_input(req.expectedExpression)

    # Handle edge case: empty strings
    if not user_str or not expected_str:
        return ValidationResponse(isEquivalent=False, error="Expression cannot be empty")

    local_dict = build_symbol_dict(req.variables or [])

    try:
        user_expr = parse_expr(user_str, local_dict=local_dict, transformations=TRANSFORMATIONS)
    except Exception as e:
        return ValidationResponse(
            isEquivalent=False,
            error=f"Failed to parse user expression: {str(e)}"
        )

    try:
        expected_expr = parse_expr(expected_str, local_dict=local_dict, transformations=TRANSFORMATIONS)
    except Exception as e:
        return ValidationResponse(
            isEquivalent=False,
            error=f"Failed to parse expected expression: {str(e)}"
        )

    try:
        is_equiv = are_expressions_equivalent(user_expr, expected_expr)
        return ValidationResponse(isEquivalent=is_equiv)
    except Exception as e:
        return ValidationResponse(
            isEquivalent=False,
            error=f"Error evaluating equivalence: {str(e)}"
        )


@app.post("/validate-number", response_model=ValidationResponse)
def validate_number(req: NumberRequest) -> ValidationResponse:
    """
    Validate that userAnswer and expectedAnswer represent the same numerical value
    within the specified tolerance. Handles fractions ('8/3', '1/2') and special
    constants ('pi', 'e', 'sqrt(2)').
    """
    user_str = sanitize_input(req.userAnswer)
    expected_str = sanitize_input(req.expectedAnswer)

    # Handle edge case: empty strings
    if not user_str or not expected_str:
        return ValidationResponse(isEquivalent=False, error="Answer cannot be empty")

    local_dict = dict(MATH_ALIASES)
    tol = req.tolerance if req.tolerance is not None else 1e-9

    try:
        user_expr = parse_expr(user_str, local_dict=local_dict, transformations=TRANSFORMATIONS)
    except Exception as e:
        return ValidationResponse(
            isEquivalent=False,
            error=f"Failed to parse user answer: {str(e)}"
        )

    try:
        expected_expr = parse_expr(expected_str, local_dict=local_dict, transformations=TRANSFORMATIONS)
    except Exception as e:
        return ValidationResponse(
            isEquivalent=False,
            error=f"Failed to parse expected answer: {str(e)}"
        )

    # Check for unexpected free symbols (should be numbers/constants only)
    if user_expr.free_symbols:
        return ValidationResponse(
            isEquivalent=False,
            error="User answer contains undefined variables, expected a numerical answer"
        )
    if expected_expr.free_symbols:
        return ValidationResponse(
            isEquivalent=False,
            error="Expected answer contains undefined variables, expected a numerical answer"
        )

    # 1. Exact symbolic check
    diff = user_expr - expected_expr
    if diff == 0:
        return ValidationResponse(isEquivalent=True)

    try:
        if simplify(diff) == 0:
            return ValidationResponse(isEquivalent=True)
    except Exception:
        pass

    # 2. Numerical evaluation with tolerance
    try:
        user_val = complex(user_expr.evalf())
        exp_val = complex(expected_expr.evalf())

        # If imaginary components are negligible, compare real values
        if abs(user_val.imag) < 1e-12 and abs(exp_val.imag) < 1e-12:
            u_real = user_val.real
            e_real = exp_val.real
            diff_abs = abs(u_real - e_real)
        else:
            diff_abs = abs(user_val - exp_val)

        # Check absolute or relative tolerance
        if diff_abs <= tol:
            return ValidationResponse(isEquivalent=True)

        if abs(exp_val) > 0 and (diff_abs / abs(exp_val)) <= tol:
            return ValidationResponse(isEquivalent=True)

        return ValidationResponse(isEquivalent=False)
    except Exception as e:
        return ValidationResponse(
            isEquivalent=False,
            error=f"Numerical evaluation failed: {str(e)}"
        )


@app.post("/validate-equation", response_model=ValidationResponse)
def validate_equation(req: EquationRequest) -> ValidationResponse:
    """
    Validate that userEquation and expectedEquation have identical solution sets.
    Variable defaults to 'x'.
    """
    user_str = sanitize_input(req.userEquation)
    expected_str = sanitize_input(req.expectedEquation)

    # Handle edge case: empty strings
    if not user_str or not expected_str:
        return ValidationResponse(isEquivalent=False, error="Equation cannot be empty")

    var_name = (req.variable or "x").strip()
    var_sym = symbols(var_name)
    local_dict = build_symbol_dict([var_name])

    try:
        user_expr = parse_equation(user_str, local_dict)
    except Exception as e:
        return ValidationResponse(
            isEquivalent=False,
            error=f"Failed to parse user equation: {str(e)}"
        )

    try:
        expected_expr = parse_equation(expected_str, local_dict)
    except Exception as e:
        return ValidationResponse(
            isEquivalent=False,
            error=f"Failed to parse expected equation: {str(e)}"
        )

    # Check for direct identity or proportionality before solving
    try:
        if are_expressions_equivalent(user_expr, expected_expr):
            return ValidationResponse(isEquivalent=True)
    except Exception:
        pass

    # Check if either or both are identities (0 = 0)
    user_is_identity = (user_expr == 0 or simplify(user_expr) == 0)
    expected_is_identity = (expected_expr == 0 or simplify(expected_expr) == 0)

    if user_is_identity and expected_is_identity:
        return ValidationResponse(isEquivalent=True)
    if user_is_identity != expected_is_identity:
        return ValidationResponse(isEquivalent=False)

    # Check if either or both have no solutions (constant non-zero, e.g. 1 = 0)
    user_is_const_nonzero = not user_expr.free_symbols and user_expr != 0 and simplify(user_expr) != 0
    expected_is_const_nonzero = not expected_expr.free_symbols and expected_expr != 0 and simplify(expected_expr) != 0

    if user_is_const_nonzero and expected_is_const_nonzero:
        return ValidationResponse(isEquivalent=True)
    if user_is_const_nonzero != expected_is_const_nonzero:
        return ValidationResponse(isEquivalent=False)

    # Solve symbolically
    try:
        user_sols_raw = sympy.solve(user_expr, var_sym)
    except Exception as e:
        # If sympy.solve fails on user expression, check proportionality
        try:
            ratio = simplify(user_expr / expected_expr)
            if ratio != 0 and ratio.is_number:
                return ValidationResponse(isEquivalent=True)
        except Exception:
            pass
        return ValidationResponse(
            isEquivalent=False,
            error=f"Could not solve user equation: {str(e)}"
        )

    try:
        expected_sols_raw = sympy.solve(expected_expr, var_sym)
    except Exception as e:
        try:
            ratio = simplify(user_expr / expected_expr)
            if ratio != 0 and ratio.is_number:
                return ValidationResponse(isEquivalent=True)
        except Exception:
            pass
        return ValidationResponse(
            isEquivalent=False,
            error=f"Could not solve expected equation: {str(e)}"
        )

    # Normalize solutions into deduplicated lists
    user_sols = extract_and_deduplicate_solutions(user_sols_raw, var_sym)
    expected_sols = extract_and_deduplicate_solutions(expected_sols_raw, var_sym)

    # Compare solution sets
    is_equiv = are_solution_sets_equivalent(user_sols, expected_sols)

    # If solution sets did not match directly, verify if equations are proportional
    if not is_equiv:
        try:
            ratio = simplify(user_expr / expected_expr)
            if ratio != 0 and ratio.is_number:
                is_equiv = True
        except Exception:
            pass

    return ValidationResponse(isEquivalent=is_equiv)
