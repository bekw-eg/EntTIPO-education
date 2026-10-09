"""Independent oracle: symbolic calculus, equations, substitution and exact sets.

The authoring code uses closed-form arithmetic. This verifier does not import it.
Every actual option is parsed; equal distractors or multiple answers fail closed.
"""
import hashlib
import json
import sys
import sympy as s

x, y = s.symbols('x y', real=True)
local = dict(x=x, y=y, I=s.I, pi=s.pi, exp=s.exp, sqrt=s.sqrt, log=s.log,
             sin=s.sin, cos=s.cos, tan=s.tan, asin=s.asin, acos=s.acos, atan=s.atan, oo=s.oo)


def parse(v):
    return s.sympify(str(v), locals=local)


def oracle(o):
    e, op = parse(o['expression']), o['operation']
    if op == 'evaluate':
        return s.simplify(e.subs(x, parse(o['at']))) if 'at' in o else s.simplify(e)
    if op == 'limit':
        return s.limit(e, x, parse(o['at']))
    if op == 'solve':
        domain = s.Interval.open(o['domainLower'],s.oo) if 'domainLower' in o else s.S.Reals
        roots = s.solveset(e, x, domain=domain)
        assert isinstance(roots, s.FiniteSet) and len(roots) == 1
        root = next(iter(roots))
        assert not e.subs(x, root).has(s.zoo, s.nan)
        if 'domain' in o:
            assert root != parse(o['domain'].split('!=')[1])
        return root
    if op == 'cone_net_total':
        radius = s.solve(2*s.pi*x-e,x)[0]
        assert 0 < radius < o['slant']
        return s.simplify((s.pi*radius*o['slant']+s.pi*radius**2)/s.pi)
    if op == 'derivative':
        return s.diff(e, x).subs(x, parse(o['at']))
    if op == 'inverse_trig':
        angle = parse(o['angle'])
        fn = e.func
        principal = {s.asin: s.Interval(-s.pi/2, s.pi/2), s.acos: s.Interval(0, s.pi), s.atan: s.Interval.open(-s.pi/2,s.pi/2)}[fn]
        assert angle in principal
        inv = {s.asin:s.sin, s.acos:s.cos, s.atan:s.tan}[fn]
        root = s.solve(e.args[0]-inv(angle), x)[0]
        assert s.simplify(e.subs(x,root)-angle) == 0
        return root
    if op == 'trig_roots':
        interval = s.Interval(*map(parse,o['interval']))
        roots = s.solveset(e, x, domain=interval)
        assert isinstance(roots, s.FiniteSet)
        for root in roots:
            assert s.simplify(e.subs(x,root)) == 0
        return sum(roots)
    if op == 'trig_inequality':
        # Solve in the argument coordinate on a complete period; intersect the
        # transformed domain before rescaling. Strict boundaries remain open.
        t = s.Symbol('t', real=True)
        f = {'sin':s.sin, 'cos':s.cos}[o['function']]
        relation = f(t)>s.Rational(1,2) if o['relation']=='>' else f(t)>=s.Rational(1,2)
        solved = s.solve_univariate_inequality(relation,t,relational=False)
        shift, scale = parse(o['shift']), o['scale']
        bounds = [parse(v)*scale+shift for v in o['interval']]
        actual = solved.intersect(s.Interval(*bounds))
        assert isinstance(actual,s.Interval)
        for endpoint in (actual.start,actual.end):
            assert s.simplify(f(endpoint)-s.Rational(1,2))==0 or endpoint in bounds
        return actual.measure/scale
    if op == 'expand':
        return s.expand(e)
    if op == 'degree':
        p = s.Poly(e,x,y)
        assert len({sum(m) for m,_ in p.terms()})==1
        return p.total_degree()
    if op == 'coefficient':
        return s.Poly(s.expand(e),x,y).coeff_monomial(parse(o['monomial']))
    if op == 'real_root':
        return s.real_root(e,o['degree'])
    if op == 'positive_root':
        roots = s.solveset(x**o['degree']-e,x,domain=s.Interval.open(0,s.oo))
        assert len(roots)==1
        return next(iter(roots))
    if op == 'tangent':
        at = parse(o['at'])
        slope = s.diff(e,x).subs(x,at)
        tangent = s.expand(e.subs(x,at)+slope*(x-at))
        assert s.simplify(tangent.subs(x,at)-e.subs(x,at))==0
        return slope if o['query']=='slope' else tangent.subs(x,0 if o['query']=='intercept' else o['target'])
    if op == 'primitive_value':
        primitive = s.integrate(e,x)
        assert s.simplify(s.diff(primitive,x)-e)==0
        return s.simplify(primitive.subs(x,o['target'])+o['initial']-primitive.subs(x,o['at']))
    if op == 'primitive_coefficient':
        basis = parse(o['basis'])
        coefficient = s.simplify(e/s.diff(basis,x))
        assert x not in coefficient.free_symbols
        assert s.simplify(s.diff(coefficient*basis,x)-e)==0
        return coefficient
    if op == 'complex':
        return {'real':s.re(e),'imag':s.im(e),'modulus_squared':s.expand(e*s.conjugate(e))}[o['component']]
    if op == 'ode_first':
        solution = parse(o['solution'])
        assert s.simplify(s.diff(solution,x)-e.subs(y,solution))==0
        assert solution.subs(x,0)==o['initial']
        assert not solution.has(s.zoo,s.nan)
        return solution.subs(x,parse(o['at']))
    if op == 'ode_second':
        a,b,c = o['coefficients']
        assert s.simplify(a*s.diff(e,x,2)+b*s.diff(e,x)+c*e)==0
        assert e.subs(x,0)==o['initial'][0]
        assert s.diff(e,x).subs(x,0)==o['initial'][1]
        return e.subs(x,parse(o['at']))
    raise ValueError(op)


def verify(bank, check_existing=False):
    ids, stems, identities = set(), set(), set()
    for q in bank:
        certificate = q.get('verification',{}).copy()
        old_key = q.get('mathKey')
        assert q['id'] not in ids
        assert q['text'] not in stems
        ids.add(q['id']); stems.add(q['text'])
        expected = s.simplify(oracle(q['oracle']))
        options = list(map(parse,q['options']))
        assert len(options)==4
        for i in range(4):
            assert not options[i].has(s.nan,s.zoo)
            for j in range(i):
                assert s.simplify(options[i]-options[j])!=0, (q['id'],'equivalent options',i,j)
        matches = [i for i,v in enumerate(options) if s.simplify(v-expected)==0]
        assert matches==[q['correctIndex']],(q['id'],expected,matches,q['options'])
        # The identity describes the operation and inputs, not option order,
        # language, answer formatting or explanation. Symbolic forms normalize.
        identity = {**q['oracle'], 'expression':s.srepr(parse(q['oracle']['expression']))}
        if q['oracle']['operation']=='inverse_trig':
            # asin(u)=pi/6 and acos(u)=pi/3 express the same equation.
            # Monic normalization also removes scalar multiples of a linear
            # equation, so a constant-root parameter sweep isn't diversity.
            expression=parse(q['oracle']['expression'])
            inverse={s.asin:s.sin,s.acos:s.cos,s.atan:s.tan}[expression.func]
            equation=s.Poly(expression.args[0]-inverse(parse(q['oracle']['angle'])),x).monic().as_expr()
            identity={'operation':'inverse_trig_solution','equation':s.srepr(equation)}
        if q['oracle']['operation']=='trig_roots':
            expression=parse(q['oracle']['expression'])
            domain=s.Interval(*map(parse,q['oracle']['interval']))
            identity={'operation':'trig_roots','domain':s.srepr(domain),'solutions':s.srepr(s.solveset(expression,x,domain=domain))}
        key = hashlib.sha256(json.dumps(identity,sort_keys=True).encode()).hexdigest()
        # Different graph contexts (log/base) that ask the same base equation
        # share the key and are excluded, never counted twice.
        q['mathKey'] = key
        scope_only = q['family'] in {'v2_08_decreasing','v2_08_shift','v2_09_value'}
        q['verification'] = dict(method='Independent SymPy oracle + all pairwise option comparisons',
                                 engine=f'SymPy {s.__version__}',checkedAt='2026-10-10',
                                 result='duplicate' if key in identities else 'supporting' if scope_only else 'passed',
                                 normalizedAnswer=s.sstr(expected),domainChecked=True)
        q['verification']['contentDigest'] = hashlib.sha256(json.dumps(
            [q['id'],q['pointCode'],q['band'],q['family'],q['text'],q['textKk'],q['options'],q['correctIndex'],q['explanation'],q['explanationKk'],key,q['oracle'],q['verification']['result']],
            ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
        if check_existing:
            assert old_key == key, (q['id'],'stale mathematical identity')
            for field in ('result','normalizedAnswer','contentDigest'):
                assert certificate.get(field) == q['verification'][field], (q['id'],'stale certificate',field)
        identities.add(key)
    return bank


if __name__=='__main__':
    bank=json.load(sys.stdin)
    verify(bank,check_existing='--write' not in sys.argv)
    if '--write' in sys.argv:
        json.dump(bank,sys.stdout,ensure_ascii=False,indent=2)
    else:
        print(json.dumps(dict(checked=len(bank),unique=len({q['mathKey'] for q in bank}),
                             families=len({q['family'] for q in bank}),status='passed')))
