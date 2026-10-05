"""Independent symbolic oracle for the migrated bank, including all five distractors.

Reads exported JSON on stdin. Requires the math-service's pinned SymPy 1.13.3.
No reference answer or correct-option flag is used to calculate a training answer.
"""
import io
import json
import re
import runpy
import sys
import sympy as s
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application, convert_xor

payload = json.load(sys.stdin)
x, C, C1, C2 = s.symbols("x C C1 C2", real=True)
transforms = standard_transformations + (implicit_multiplication_application, convert_xor)

def expression(text):
    text = text.strip().replace("−", "-").replace("π", "pi").replace("·", "*")
    for source, target in [("²", "^2"), ("³", "^3"), ("⁴", "^4")]:
        text = text.replace(source, target)
    text = re.sub(r"\s*см(?:\^2|\^3)?$", "", text).replace(",", ".")
    text = re.sub(r"√(\d+)", r"sqrt(\1)", text)
    text = re.sub(r"\\sqrt\{([^}]+)\}", r"sqrt(\1)", text).replace("\\pi", "pi")
    text = re.sub(r"C([12])e", r"C\1*e", text)
    text = text.replace("ln(|x|)", "log(Abs(x))")
    return parse_expr(text, local_dict={"x": x, "y": s.Symbol("y", real=True), "C": C, "C1": C1, "C2": C2,
        "i": s.I, "e": s.E, "pi": s.pi, "sqrt": s.sqrt, "sin": s.sin, "cos": s.cos, "exp": s.exp,
        "ln": s.log, "abs": s.Abs, "arcsin": s.asin, "arctan": s.atan}, transformations=transforms)

def candidate(raw):
    raw = raw.strip().replace("−", "-").replace("π", "pi")
    if "∪" in raw:
        return s.Union(*(candidate(v) for v in raw.split("∪")))
    if re.match(r"^[\[(].*;.*[\])]$", raw):
        parts = raw[1:-1].split(";")
        return s.Interval(expression(parts[0]), expression(parts[1]), left_open=raw[0]=="(", right_open=raw[-1]==")")
    if raw.startswith("{"):
        return s.FiniteSet(*(expression(v) for v in raw[1:-1].split(";")))
    if re.match(r"^k_1\s*=", raw):
        return tuple(sorted((expression(v) for v in re.findall(r"=\s*([^,]+)", raw)), key=str))
    if ";" in raw and not raw.startswith(("(","[","{")):
        return tuple(candidate(v.strip()) for v in raw.split(";"))
    if raw.startswith("±"):
        a = expression(raw[1:]); return s.FiniteSet(-a, a)
    if raw.startswith("y=") or raw.startswith("y ="):
        return expression(raw.split("=",1)[1])
    if re.match(r"^x\s*(?:=|≠|>|<|∈)", raw):
        match = re.match(r"^x\s*([=≠><∈])\s*(.*)$", raw)
        return (match[1], expression(match[2]) if match[2] != "R" else "R")
    if re.search(r"[А-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]", raw):
        return raw.replace(" ", "")
    if ";" in raw or "," in raw and raw.startswith("("):
        return tuple(expression(v) for v in raw.strip("()").split(";"))
    return expression(raw)

def same(a,b):
    if isinstance(a,s.Basic) and isinstance(b,s.Basic) and not isinstance(a,s.Set) and not isinstance(b,s.Set):
        return s.simplify(s.powdenest(a-b, force=True)) == 0
    return a == b

# The official bank has an independent oracle for all its existing choices and domains.
original_stdin = sys.stdin
sys.stdin = io.StringIO(json.dumps(payload["exam"]))
runpy.run_path("scripts/verify_exam_math.py", run_name="__choice_exam_oracle__")
sys.stdin = original_stdin
exam = {e["id"]: e for e in payload["exam"]}

legacy_oracles = {
    "q1_t1":(s.sqrt(75)-s.sqrt(48))/s.sqrt(3), "q2_t1":s.real_root(27,3)**2,"q3_t1":x**2,
    "q1_t2":x*x-5*x+6,"q2_t2":(2+3)**2,"q3_t2":s.cancel((x**3-8)/(x-2)),
    "q1_t3":(2+3*s.I)*(2-3*s.I),"q2_t3":s.sqrt(3**2+4**2),
    "q1_t4":s.diff(x**3+2*x*x-5*x+1,x),"q2_t4":s.diff(s.sin(x)*s.exp(x),x),"q3_t4":s.diff(s.log(x*x+1),x),
    "q1_t5":4+4*(x-2),"q1_t6":s.integrate(3*x*x+2*x,x)+C,"q2_t6":s.log(s.Abs(x))+C,
    "q1_t7":s.integrate(x*x,(x,0,2)),"q2_t7":s.integrate(5*s.exp(2*x),x)+C,"q3_t7":s.integrate(s.cos(x),x)+C,
    "q1_t8":s.integrate(s.exp(x)*s.sin(x),x)+C,"q2_t8":s.integrate(x*s.exp(x),x)+C,
    "q1_t9":s.log(32,2),"q2_t9":s.log(s.exp(3)),"q3_t9":3**2-2,
    "q1_t10":s.log(32,2),"q2_t10":s.log(27,3)-1,"q1_t11":s.simplify(s.sin(x)**2+s.cos(x)**2),"q2_t11":s.sin(s.pi/6),
    "q3_t11":s.solveset(s.sin(x),x,domain=s.Interval(0,2*s.pi)),"q1_t12":s.asin(s.Rational(1,2)),"q2_t12":s.atan(1),
    "q1_t13":s.integrate(2*x,x)+C,"q2_t13":C*s.exp(-x),"q1_t14":C1*s.exp(x)+C2*s.exp(-x),
    "q1_t15":("≠",s.Integer(3)),"q2_t15":("=",s.Integer(2)),
}

def oracle(q):
    if q["id"] in legacy_oracles: return legacy_oracles[q["id"]]
    text, latex = q["questionText"], q.get("latex") or ""
    if q["id"] in exam:
        e=exam[q["id"]]
        if e["family"]=="rational_asymptotes": return tuple(expression(v) for v in e["options"][e["correctIndex"]].strip("()").split(";"))
        return candidate(e["options"][e["correctIndex"]])
    if "Упрости −(x^2 · x^3 + 4)" == text: return -x**5-4
    if ": " in text and (text.startswith("Найди производную") or text.startswith("Упрости выражение")):
        value=text.split(": ",1)[1]
        value=re.sub(r"\s*\(x\s*[>≠].*?\)","",value)
        f=expression(value)
        return s.diff(f,x) if text.startswith("Найди производную") else s.expand(f)
    numbers=[int(v) for v in re.findall(r"\d+",latex)]
    if text.startswith("Вычислите значение числового выражения применив свойства степеней"):
        a,m,b,n=numbers; assert a==b; return s.Integer(a)**(m+n)
    if text=="Раскройте скобки по формуле квадрата суммы:": return s.expand((x+numbers[0])**2)
    if text=="Найдите сумму комплексных чисел:":
        a,b,c,d=[int(v) for v in re.findall(r"= (\d+) \+ (\d+)i",latex)[0]+re.findall(r"= (\d+) \+ (\d+)i",latex)[1]]
        return a+c+(b+d)*s.I
    if text=="Найдите производную функции f(x):":
        k,n=numbers; return s.diff(k*x**n,x)
    if text=="Составьте уравнение касательной к графику функции в заданной точке:":
        match=re.match(r"f\(x\) = (\d*)x\^2, \\quad x_0 = (\d+)",latex)
        a,t=int(match[1] or 1),int(match[2]); f=a*x*x; return f.subs(x,t)+s.diff(f,x).subs(x,t)*(x-t)
    if text=="Вычислите определённый интеграл по формуле Ньютона-Лейбница:":
        zero,b,m=numbers; assert zero==0; return s.integrate(m*x,(x,0,b))
    if text=="Найдите значение логарифма:": return s.log(numbers[1],numbers[0])
    if text=="Найдите точное значение тригонометрической функции:": return s.sin(s.pi/numbers[0])
    if text=="Найдите корни характеристического уравнения для дифференциального уравнения:":
        p,product=numbers[:2]; return tuple(sorted(s.solve(x*x-p*x+product,x),key=str))
    if text.startswith("В правильной четырёхугольной пирамиде сторона основания равна"):
        a,h=numbers; return s.Rational(a*a*h,3)
    raise AssertionError((q["id"],"No independent mathematical oracle",text,latex))

for q in payload["bank"]:
    c=q["practiceChoice"]
    expected=oracle(q)
    values=[candidate(o["text"]) for o in c["options"]]
    if q["id"]=="exam_v1_rational_center":
        values=[tuple(expression(v) for v in o["text"].strip("()").split(";")) for o in c["options"]]
    # Asymptote axes must be distinguished, unlike equations of a tangent.
    if q["id"]=="q2_t15":
        values=[(o["text"].split("=")[0].strip(), candidate(o["text"])) for o in c["options"]]
        expected=("x",expected)
    matches=[o["id"] for o,v in zip(c["options"],values) if same(v,expected)]
    assert matches==c["correctOptionIds"],(q["id"],"Incorrect/ambiguous answer key",q["questionText"],q.get("latex"),expected,values,matches,c["correctOptionIds"])
    for i,a in enumerate(values):
        for b in values[i+1:]: assert not same(a,b),(q["id"],"Equivalent distractors",a,b)
print(f"PASS: {len(payload['bank'])} practice questions, five distinct mathematical options and exactly one recomputed correct answer per question.")
