"""Independent SymPy checks for every authored exercise; reads JSON on stdin.

Run through `npm run test:exam:math` (the existing math-service container), or
`npx tsx scripts/export_exam_math.ts | python scripts/verify_exam_math.py` with SymPy installed.
The oracle recomputes mathematical results, rather than trusting the stored answer index.
"""
import json
import sys
import sympy as s

questions = json.load(sys.stdin)
by_id = {q["id"].removeprefix("exam_v1_"): q for q in questions}
x, y = s.symbols("x y", real=True)
pi = s.pi


def check(name, computed, options):
    q = by_id.pop(name)
    correct = []
    for i, option in enumerate(options):
        if isinstance(computed, s.Basic) and not isinstance(computed, s.Set):
            same = s.simplify(computed - option) == 0
        else:
            same = computed == option
        if same:
            correct.append(i)
    assert len(options) == len(q["options"]) == 4, name
    assert correct == [q["correctIndex"]], (name, computed, correct)
    # Bind each independently parsed candidate to the actual authored option text.
    assert q["options"] == texts[name], (name, "Option text changed; update and re-review the mathematical oracle")
    assert q["explanation"], name


texts = {
    "rational_center": ["(1; 2)", "(−1; 2)", "(1; 3)", "(2; 1)"],
    "rational_range": ["Все действительные числа", "Все действительные, кроме −1", "Все действительные, кроме 3", "Только положительные числа"],
    "inverse_arcsin": ["1/4", "1/2", "3/4", "1"],
    "inverse_range": ["0", "1", "2", "Бесконечно много"],
    "trig_equation": ["{π/3}", "{π/3; 5π/3}", "{π/6; 5π/6}", "{0; 2π}"],
    "trig_inequality": ["[π/6; 5π/6]", "(π/6; 5π/6)", "(5π/6; 2π)", "[0; π/6)"],
    "trig_scaled": ["[π/2; 3π/2]", "[π/4; 3π/4]", "[π/4; 3π/4] ∪ [5π/4; 7π/4]", "(π/4; 3π/4) ∪ (5π/4; 7π/4)"],
    "poly_standard": ["x²+4y²", "x²+2xy+4y²", "x²+y²", "x²−2xy+4y²"],
    "poly_classify": ["Однородный степени 2, симметричный", "Однородный степени 3, симметричный", "Однородный степени 3, несимметричный", "Неоднородный, симметричный"],
    "root_absolute": ["−7", "7", "49", "±7"],
    "root_rationalize": ["√5−2", "√5+2", "(√5+2)/9", "1/√5−1/2"],
    "exp_points": ["−3", "1/9", "1/3", "3"],
    "exp_decreasing": ["Функция возрастает и положительна", "Функция убывает и положительна", "Функция убывает и отрицательна", "Функция периодична"],
    "log_points": ["2", "1/4", "1/2", "4"],
    "log_shift": ["x>0; x=0", "x>3; x=3", "x≠3; x=3", "x<3; x=3"],
    "derivative_fraction": ["2", "3", "6", "12"],
    "tangent_inverse": ["y=x", "y=−x", "y=−x+2", "y=x−2"],
    "integral_exponential": ["6e^(3x)+C", "18e^(3x)+C", "2e^(3x)+C", "2e^x+C"],
    "complex_division": ["1+2i", "2+i", "1−2i", "2−i"],
    "cylinder_total": ["30π см²", "48π см²", "45π см²", "24π см²"],
    "cylinder_net": ["8 см", "4 см", "6 см", "2 см"],
    "cylinder_inverse": ["10 см", "2,5 см", "5 см", "8 см"],
    "cone_total": ["12π см²", "15π см²", "24π см²", "21π см²"],
    "cone_sector": ["1 см", "2 см", "3 см", "4 см"],
    "cone_inverse": ["5 см", "10 см", "√91 см", "30 см"],
    "prism_oblique": ["20 см³", "60 см³", "84 см³", "28 см³"],
    "pyramid_frustum": ["68 см³", "98 см³", "204 см³", "30 см³"],
    "cylinder_volume": ["144π см³", "12π см³", "36π см³", "24π см³"],
    "cone_volume_height": ["100π см³", "325π/3 см³", "300π см³", "65π см³"],
    "cone_frustum": ["20π см³", "48π см³", "28π см³", "12π см³"],
}
f = (2*x+3)/(x-1)
check("rational_center", (s.solve(x-1, x)[0], s.limit(f, x, s.oo)), [(1,2),(-1,2),(1,3),(2,1)])
check("rational_range", s.calculus.util.function_range((3*x-2)/(x+1), x, s.S.Reals),
      [s.S.Reals, s.S.Reals-s.FiniteSet(-1), s.S.Reals-s.FiniteSet(3), s.Interval.open(0,s.oo)])
check("inverse_arcsin", s.solve(2*x-1-s.sin(pi/6),x)[0], [s.Rational(1,4),s.Rational(1,2),s.Rational(3,4),s.Integer(1)])
assert s.asin(s.Rational(1,2)) == pi/6
check("inverse_range", 0 if not (0 <= 4*pi/3 <= pi) else 1, [0,1,2,"infinite"])
check("trig_equation", s.solveset(2*s.cos(x)-1,x,domain=s.Interval(0,2*pi)),
      [s.FiniteSet(pi/3),s.FiniteSet(pi/3,5*pi/3),s.FiniteSet(pi/6,5*pi/6),s.FiniteSet(0,2*pi)])
base = s.solve_univariate_inequality(s.sin(x)>s.Rational(1,2),x,relational=False)
check("trig_inequality", base.intersect(s.Interval(0,2*pi)),
      [s.Interval(pi/6,5*pi/6),s.Interval.open(pi/6,5*pi/6),s.Interval.open(5*pi/6,2*pi),s.Interval.Ropen(0,pi/6)])
# Verify both periods and all included/excluded boundary points independently.
scaled = s.Union(s.Interval(pi/4,3*pi/4),s.Interval(5*pi/4,7*pi/4))
for k in range(49):
    at = k*pi/24
    assert bool(scaled.contains(at)) == bool(s.cos(2*at)<=0)
check("trig_scaled", scaled, [s.Interval(pi/2,3*pi/2),s.Interval(pi/4,3*pi/4),scaled,
      s.Union(s.Interval.open(pi/4,3*pi/4),s.Interval.open(5*pi/4,7*pi/4))])
check("poly_standard", s.expand((x+y)**2-2*x*y+3*y*y), [x*x+4*y*y,x*x+2*x*y+4*y*y,x*x+y*y,x*x-2*x*y+4*y*y])
p=x*x*y+x*y*y
check("poly_classify", (s.Poly(p,x,y).total_degree(),s.expand(p-p.xreplace({x:y,y:x}))==0), [(2,True),(3,True),(3,False),(None,True)])
check("root_absolute", s.sqrt((-7)**2), [s.Integer(-7),s.Integer(7),s.Integer(49),s.Symbol('plus_minus_7')])
check("root_rationalize", 1/(s.sqrt(5)-2), [s.sqrt(5)-2,s.sqrt(5)+2,(s.sqrt(5)+2)/9,1/s.sqrt(5)-s.Rational(1,2)])
positive_base = s.solve(x*x-9,x)[1]
check("exp_points", 1/positive_base, [s.Integer(-3),s.Rational(1,9),s.Rational(1,3),s.Integer(3)])
check("exp_decreasing", (s.log(s.Rational(1,3))<0, s.Rational(1,3)>0), [(False,True),(True,True),(True,False),(False,False)])
check("log_points", s.sqrt(s.Rational(1,4)), [s.Integer(2),s.Rational(1,4),s.Rational(1,2),s.Integer(4)])
assert s.simplify(s.log(4)/s.log(s.Rational(1,2))) == -2
domain=s.solve_univariate_inequality(x-3>0,x,relational=False)
assert s.limit(s.log(x-3)/s.log(2),x,3,dir='+') == -s.oo
check("log_shift", (domain,3), [(s.Interval.open(0,s.oo),0),(s.Interval.open(3,s.oo),3),(s.S.Reals-s.FiniteSet(3),3),(s.Interval.open(-s.oo,3),3)])
check("derivative_fraction", s.diff(x**s.Rational(3,2),x).subs(x,4), [s.Integer(2),s.Integer(3),s.Integer(6),s.Integer(12)])
check("tangent_inverse", (1/x).subs(x,1)+s.diff(1/x,x).subs(x,1)*(x-1), [x,-x,-x+2,x-2])
check("integral_exponential", s.integrate(6*s.exp(3*x),x), [6*s.exp(3*x),18*s.exp(3*x),2*s.exp(3*x),2*s.exp(x)])
check("complex_division", (3+s.I)/(1-s.I), [1+2*s.I,2+s.I,1-2*s.I,2-s.I])
check("cylinder_total", 2*pi*3*5+2*pi*3**2, [30*pi,48*pi,45*pi,24*pi])
check("cylinder_net", 8*pi/(2*pi), [s.Integer(8),s.Integer(4),s.Integer(6),s.Integer(2)])
check("cylinder_inverse", 40*pi/(2*pi*4), [s.Integer(10),s.Rational(5,2),s.Integer(5),s.Integer(8)])
check("cone_total", pi*3*s.sqrt(3**2+4**2)+pi*3**2, [12*pi,15*pi,24*pi,21*pi])
check("cone_sector", s.Rational(120,360)*2*pi*6/(2*pi), [s.Integer(1),s.Integer(2),s.Integer(3),s.Integer(4)])
check("cone_inverse", 30*pi/(pi*3), [s.Integer(5),s.Integer(10),s.sqrt(91),s.Integer(30)])
check("prism_oblique", s.Integer(12)*5, [s.Integer(20),s.Integer(60),s.Integer(84),s.Integer(28)])
check("pyramid_frustum", s.Rational(6,3)*(9+25+s.sqrt(9*25)), [s.Integer(68),s.Integer(98),s.Integer(204),s.Integer(30)])
check("cylinder_volume", pi*(s.Rational(6,2))**2*4, [144*pi,12*pi,36*pi,24*pi])
check("cone_volume_height", pi*5**2*s.sqrt(13**2-5**2)/3, [100*pi,s.Rational(325,3)*pi,300*pi,65*pi])
check("cone_frustum", pi*s.Rational(3,3)*(4**2+4*2+2**2), [20*pi,48*pi,28*pi,12*pi])
assert not by_id, ("Exercises without independent oracle", list(by_id))
print("PASS: all 30 authored tasks, reference answers, four distinct mathematical choices, domains and boundary conditions verified with SymPy.")
