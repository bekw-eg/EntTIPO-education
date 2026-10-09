"""Original B057 templates. Arithmetic answers are independently checked by SymPy.

Run in the existing entTIPO_math container, with verify_generated_exam_math.py.
No third-party questions are imported. Stable IDs and semantic keys survive reruns.
"""
import json
import sys
from fractions import Fraction as F
from verify_generated_exam_math import verify


def num(v):
    return str(v)


def generate(per_family):
    rows = []
    def put(point, name, n, ru, kk, answer, wrong, rule, rule_kk, oracle):
        choices = [num(answer), *map(num, wrong)]
        shift = n % 4
        choices = choices[shift:] + choices[:shift]
        # Classify the reasoning, not the number of digits or a topic quota.
        band = 'A' if point in (2, 6, 8, 14, 17) else 'B'
        if (point == 15 and name != 'additive') or point == 16 or (point == 18 and name in ('sector','sector_total')) or (point == 19 and name == 'frustum') or (point == 20 and name != 'cylinder'):
            band = 'C'
        if (point == 7 and name == 'signed_sum') or (point == 20 and name == 'cylinder'):
            band = 'A'
        rows.append(dict(id=f'exam_v2_{point:02}_{name}_{n:03}', pointCode=f'{point:02}', band=band,
                         family=f'v2_{point:02}_{name}', text=ru, textKk=kk, options=choices,
                         correctIndex=(4-shift) % 4,
                         explanation=f'1. {rule}\n2. Подставляем данные условия и упрощаем: {answer}.\n3. Проверяем область определения и сравниваем все четыре варианта; подходит только {answer}.',
                         explanationKk=f'1. {rule_kk}\n2. Берілген мәндерді қойып, ықшамдаймыз: {answer}.\n3. Анықталу облысын және төрт жауапты тексереміз; тек {answer} сәйкес келеді.',
                         scope=name, source='Original Synaq generator scripts/build_verified_exam_bank.py v2; no imported exercises',
                         oracle=oracle))
    for n in range(1, per_family+1):
        a, b, c = n+2, n+3, n+1
        def p(point, name, ru, kk, answer, wrong, rule, rk, operation, expression, **args):
            put(point, name, n, ru, kk, answer, wrong, rule, rk, dict(operation=operation, expression=expression, **args))
        # 01: recover an excluded value, invert a rational function, use its derivative.
        e=f'{a}+{b}/(x-{c})'
        p(1,'horizontal',f'Найдите горизонтальную асимптоту y={e}. Укажите её ординату.',f'y={e} көлденең асимптотасының ординатасын табыңыз.',a,[c,a+b,-a],f'При x→∞ дробь {b}/(x-{c})→0, остаётся {a}.',f'x→∞ кезінде {b}/(x-{c})→0, сондықтан {a} қалады.','limit',e,at='oo')
        target=a+1
        p(1,'inverse',f'При каком x функция y={e} принимает значение {target}?',f'y={e} функциясы қандай x кезінде {target} мәнін қабылдайды?',b+c,[c-b,c,c+b+1],f'Вычитаем {a}: {b}/(x-{c})=1. Знаменатель не равен нулю; x={b+c}.',f'{a} санын азайтамыз: {b}/(x-{c})=1. Бөлім нөл емес; x={b+c}.','solve',f'({e})-({target})',domain=f'x!={c}')
        p(1,'slope',f'Для f(x)={e} найдите f′({c+1}).',f'f(x)={e} үшін f′({c+1}) мәнін табыңыз.',-b,[b,-b*b,-a],f'f′(x)=−{b}/(x-{c})²; при x={c+1} знаменатель равен 1.',f'f′(x)=−{b}/(x-{c})²; x={c+1} кезінде бөлім 1-ге тең.','derivative',e,at=c+1)
        # 02: three inverse functions, principal ranges explicitly respected.
        for name,fn,angle,value in [('arcsin','asin','pi/6',F(1,2)),('arccos','acos','pi/3',F(1,2)),('arctan','atan','pi/4',1)]:
            ans=F(c+value,a)
            p(2,name,f'Решите {name}({a}*x-{c})={angle}. Углы в радианах.',f'{name}({a}*x-{c})={angle} теңдеуін шешіңіз. Бұрыштар радианмен берілген.',ans,[F(c-value,a),c+value,F(c+value,a)+1],f'{angle} входит в главный диапазон {name}. Применяем обратную функцию: {a}x−{c}={value}, затем делим на {a}.',f'{angle} {name} негізгі мәндер аралығына жатады. Кері функцияны қолданамыз: {a}x−{c}={value}, кейін {a} санына бөлеміз.','inverse_trig',f'{fn}({a}*x-{c})',angle=angle)
        # 03: all roots on finite intervals, then their sum, never just one root.
        for name,fn,end,total,roots in [('sin','sin','pi',1,['0','pi']),('cos','cos','pi',F(1,2),['pi/2']),('tan','tan','pi',1,['0','pi'])]:
            ans=f'({total})*pi/{a}'
            wrong=[f'({total})*pi/{2*a}',f'({total})*pi*{a}',f'({total})*pi/{a+1}']
            p(3,name,f'Найдите сумму всех решений {fn}({a}*x)=0 на [0; {end}/{a}]. Углы в радианах.',f'[0; {end}/{a}] аралығындағы {fn}({a}*x)=0 теңдеуінің барлық шешімдерінің қосындысын табыңыз. Бұрыштар радианмен берілген.',ans,wrong,f'Положим t={a}x. На [0; {end}] корни: {", ".join(roots)}. Делим каждый корень на {a} и складываем.',f't={a}x болсын. [0; {end}] аралығындағы түбірлер: {", ".join(roots)}. Әр түбірді {a} санына бөліп, қосамыз.','trig_roots',f'{fn}({a}*x)',scale=a,function=fn,interval=[0,f'{end}/{a}'])
        # 04: solution sets and boundary inclusion checked independently.
        for name,fn,relation,length,start,end in [('sin_strict','sin','>',F(2,3),'pi/6','5*pi/6'),('cos_closed','cos','>=',F(1,3),'0','pi/3'),('sin_shift','sin','>=',F(2,3),'pi/6','pi/2')]:
            shift='pi/6' if name=='sin_shift' else '0'
            expr=f'{fn}({a}*x+{shift})'
            ans=f'({length})*pi/{a}'
            p(4,name,f'Найдите суммарную длину множества решений {expr}{relation}1/2 на [0; pi/{a}]. Углы в радианах.',f'[0; pi/{a}] аралығында {expr}{relation}1/2 теңсіздігінің шешімдер жиынының жалпы ұзындығын табыңыз. Бұрыштар радианмен берілген.',ans,[f'pi/{a}',f'({length})*pi/{2*a}',f'({length})*pi*{a}'],f'Сначала решаем неравенство на единичной окружности, учитывая сдвиг {shift} и границы. Длина по аргументу равна {length}π; при переходе к x делим на {a}.',f'Алдымен бірлік шеңберде {shift} ығысуын және шекараларды ескеріп, теңсіздікті шешеміз. Аргумент бойынша ұзындық {length}π; x айнымалысына өткенде {a} санына бөлеміз.','trig_inequality',expr,scale=a,function=fn,shift=shift,relation=relation,interval=[0,f'pi/{a}'])
        # 05: expansion, homogeneous degree, and coefficient extraction.
        e=f'(x+{a}*y)**2-2*{a}*x*y+{b}*y**2'
        ans=f'x**2+{a*a+b}*y**2'
        p(5,'expand',f'Приведите ({e}) к стандартному виду.',f'({e}) өрнегін стандарт түрге келтіріңіз.',ans,[f'x**2+{a*a-b}*y**2',f'x**2+{a+b}*y**2',f'x**2+2*{a}*x*y+{a*a+b}*y**2'],'Раскрываем квадрат суммы, приводим подобные: смешанные члены взаимно уничтожаются.','Қосынды квадратын ашып, ұқсас мүшелерді біріктіреміз: аралас мүшелер қысқарады.','expand',e)
        e=f'x**{a}*y**2+x**2*y**{a}'
        p(5,'degree',f'Найдите степень однородного многочлена {e}.',f'{e} біртекті көпмүшесінің дәрежесін табыңыз.',a+2,[a,2*a,a+1],f'У каждого одночлена сумма показателей равна {a}+2. Все одночлены одной степени.',f'Әр бірмүшенің көрсеткіштер қосындысы {a}+2. Барлық бірмүшелердің дәрежесі бірдей.','degree',e)
        e=f'(x+{a}*y)*(x-{b}*y)'
        p(5,'coefficient',f'Найдите коэффициент при xy после раскрытия {e}.',f'{e} жақшаларын ашқаннан кейін xy коэффициентін табыңыз.',a-b,[a+b,a*b,b-a],f'Коэффициенты смешанных слагаемых: {a} и −{b}; складываем их.',f'Аралас мүшелердің коэффициенттері {a} және −{b}; оларды қосамыз.','coefficient',e,monomial='x*y')
        # 06: even-root sign, odd negative root, root-product exact arithmetic.
        p(6,'absolute',f'Вычислите sqrt(({ -a })²). Корень арифметический.',f'sqrt(({ -a })²) мәнін есептеңіз. Түбір арифметикалық.',a,[-a,a*a,-a*a],'Для действительного u: sqrt(u²)=|u|; арифметический корень неотрицателен.','Нақты u үшін sqrt(u²)=|u|; арифметикалық түбір теріс емес.','evaluate',f'sqrt({a*a})')
        p(6,'odd',f'Вычислите действительный кубический корень из {-a**3}.',f'{-a**3} санының нақты куб түбірін есептеңіз.',-a,[a,-a*a,a*a],'Нечётный корень сохраняет знак. Куб найденного числа равен подкоренному числу.','Тақ түбір таңбаны сақтайды. Табылған санның кубы түбір астындағы санға тең.','real_root',str(-a**3),degree=3)
        p(6,'product',f'Вычислите sqrt({a*a}*{b*b}).',f'sqrt({a*a}*{b*b}) мәнін есептеңіз.',a*b,[a+b,a*a*b*b,a*b+1],'Оба множителя положительны. Корень произведения равен произведению арифметических корней.','Екі көбейткіш те оң. Көбейтіндінің түбірі арифметикалық түбірлердің көбейтіндісіне тең.','evaluate',f'sqrt({a*a}*{b*b})')
        p(6,'fourth',f'Найдите арифметический корень четвёртой степени из {16*a**4}.',f'{16*a**4} санының арифметикалық төртінші дәрежелі түбірін табыңыз.',2*a,[-2*a,4*a,4*a*a],f'{16*a**4}=16·{a}⁴=(2·{a})⁴. Арифметический корень чётной степени неотрицателен.',f'{16*a**4}=16·{a}⁴=(2·{a})⁴. Жұп дәрежелі арифметикалық түбір теріс емес.','positive_root',str(16*a**4),degree=4)
        # 07: conjugate, signed radical cancellation, quotient domain.
        e=f'1/(sqrt({a*a+1})-{a})'
        ans=f'sqrt({a*a+1})+{a}'
        p(7,'conjugate',f'Рационализируйте знаменатель {e}.',f'{e} өрнегінің бөлімін иррационалдықтан арылтыңыз.',ans,[f'sqrt({a*a+1})-{a}',f'(sqrt({a*a+1})+{a})/{2*a*a+1}',f'{a}'],f'Умножаем на сопряжённое. Знаменатель ({a*a+1})−{a}²=1; он ненулевой.',f'Түйіндес өрнекке көбейтеміз. Бөлім ({a*a+1})−{a}²=1; ол нөл емес.','evaluate',e)
        e=f'sqrt(({c}-{a})**2)+sqrt(({b}+{c})**2)'
        p(7,'signed_sum',f'Упростите {e}.',f'{e} өрнегін ықшамдаңыз.',a+b,[-a+b+2*c,a-b,a+b+2*c],f'Корень квадрата — модуль. {c}−{a}<0, а {b}+{c}>0; раскрываем модули с правильными знаками.',f'Квадрат түбірі — модуль. {c}−{a}<0, ал {b}+{c}>0; модульдерді тиісті таңбамен ашамыз.','evaluate',e)
        e=f'(sqrt({a*a+1})+{a})/(sqrt({a*a+1})-{a})'
        ans=f'{2*a*a+1}+{2*a}*sqrt({a*a+1})'
        p(7,'quotient',f'Упростите {e}.',f'{e} өрнегін ықшамдаңыз.',ans,[f'{2*a*a+1}-{2*a}*sqrt({a*a+1})',f'{2*a*a+1}',f'{a}*sqrt({a*a+1})'],f'Знаменатель положителен. Умножаем на сопряжённое; знаменатель становится 1. Раскрываем квадрат числителя.',f'Бөлім оң. Түйіндеске көбейтеміз; бөлім 1 болады. Алымдағы квадратты ашамыз.','evaluate',e)
        # 08: reconstruct base, compare decreasing graph, exponential shifts.
        p(8,'base',f'График y=q^x, q>0, q≠1, проходит через (2; {a*a}). Найдите q.',f'y=q^x, q>0, q≠1 графигі (2; {a*a}) нүктесі арқылы өтеді. q мәнін табыңыз.',a,[-a,a*a,F(1,a)],f'q²={a*a}. Основание положительно, выбираем положительный корень.',f'q²={a*a}. Негіз оң, сондықтан оң түбірді таңдаймыз.','positive_root',str(a*a),degree=2)
        e=f'(1/{a})**x'
        p(8,'decreasing',f'Для y={e} найдите y(−2).',f'y={e} үшін y(−2) мәнін табыңыз.',a*a,[F(1,a*a),-a*a,2*a],'Отрицательный показатель переворачивает основание; затем возводим в квадрат. Функция убывает, но значения положительны.','Теріс көрсеткіш негізді кері айналдырады; кейін квадраттаймыз. Функция кемиді, бірақ мәндері оң.','evaluate',e,at=-2)
        e=f'2**(x-{a})+{b}'
        p(8,'shift',f'Для f(x)={e} найдите f({a}).',f'f(x)={e} үшін f({a}) мәнін табыңыз.',1+b,[b,b+2,2**a+b],f'При x={a} показатель равен 0. Любое ненулевое основание в нулевой степени даёт 1; учитываем вертикальный сдвиг.',f'x={a} кезінде көрсеткіш 0. Нөл емес негіздің нөлінші дәрежесі 1; тік ығысуды ескереміз.','evaluate',e,at=a)
        # 09: recover log base, shifted graph value, asymptote from domain.
        p(9,'base',f'График y=log_q(x), q>0, q≠1, проходит через ({a*a}; 2). Найдите q.',f'y=log_q(x), q>0, q≠1 графигі ({a*a}; 2) нүктесі арқылы өтеді. q мәнін табыңыз.',a,[-a,a*a,F(1,a)],f'По определению логарифма q²={a*a}; основание положительно и не равно 1.',f'Логарифм анықтамасы бойынша q²={a*a}; негіз оң және 1-ге тең емес.','positive_root',str(a*a),degree=2)
        e=f'log(x-{a})/log(2)'
        p(9,'value',f'Для f(x)=log_2(x−{a}) найдите f({a+8}).',f'f(x)=log_2(x−{a}) үшін f({a+8}) мәнін табыңыз.',3,[a+8,8,2],f'Аргумент {a+8}−{a}=8>0. Так как 2³=8, логарифм равен 3.',f'Аргумент {a+8}−{a}=8>0. 2³=8 болғандықтан, логарифм 3-ке тең.','evaluate',e,at=a+8)
        p(9,'boundary',f'Найдите абсциссу вертикальной асимптоты y=log_2({b}*x−{a}).',f'y=log_2({b}*x−{a}) тік асимптотасының абсциссасын табыңыз.',F(a,b),[F(-a,b),F(b,a),a*b],f'Аргумент положителен при x>{a}/{b}. На границе аргумент стремится к 0 справа, логарифм к −∞.',f'x>{a}/{b} кезінде аргумент оң. Шекарада аргумент оң жақтан 0-ге, логарифм −∞-ке ұмтылады.','solve',f'{b}*x-{a}')
        p(9,'axis',f'Найдите абсциссу пересечения графика y=log_(1/{a})(x−{b})+2 с осью Ox.',f'y=log_(1/{a})(x−{b})+2 графигінің Ox осімен қиылысу абсциссасын табыңыз.',a*a+b,[F(1,a*a)+b,a+b,a*a-b],f'На оси Ox: y=0. При x>{b} получаем log_(1/{a})(x−{b})=−2, x−{b}=(1/{a})^(−2)={a*a}. Полученное x допустимо.',f'Ox осінде y=0. x>{b} кезінде log_(1/{a})(x−{b})=−2, x−{b}=(1/{a})^(−2)={a*a}. Табылған x анықталу облысына жатады.','solve',f'log(x-{b})/log(1/{a})+2',domainLower=b)
        # 10: power, product and chain derivative.
        for name,e,at,ans,wrong,rule,rk in [
            ('power',f'{a}*x**3+{b}*x',2,12*a+b,[6*a+b,8*a+b,12*a], 'Применяем правило степени к каждому слагаемому: (kx³)′=3kx², (bx)′=b.','Әр мүшеге дәреженің туындысы ережесін қолданамыз: (kx³)′=3kx², (bx)′=b.'),
            ('product',f'(x+{a})*(x+{b})',1,a+b+2,[a+b,a*b,a+b+1],'Применяем (uv)′=u′v+uv′; оба линейных множителя имеют производную 1.','(uv)′=u′v+uv′ ережесін қолданамыз; екі сызықтық көбейткіштің туындысы 1.'),
            ('chain',f'({a}*x+{b})**2',0,2*a*b,[2*b,a*b,2*a],'По цепному правилу умножаем производную внешнего квадрата на производную внутренней линейной функции.','Күрделі функция ережесі бойынша сыртқы квадраттың туындысын ішкі сызықтық функцияның туындысына көбейтеміз.')]:
            p(10,name,f'Для f(x)={e} найдите f′({at}).',f'f(x)={e} үшін f′({at}) мәнін табыңыз.',ans,wrong,rule,rk,'derivative',e,at=at)
        # 11: tangent slope, intercept and value at another point.
        for name,e,at,query,ans,wrong in [('slope',f'{a}*x**2+{b}',1,'slope',2*a,[a,2*a+b,-2*a]),('intercept',f'x**2+{a}*x+{b}',2,'intercept',b-4,[b+4,b,b-2]),('value',f'{a}*x**2+{b}',1,'value',3*a+b,[4*a+b,2*a+b,a+b])]:
            label={'slope':'угловой коэффициент','intercept':'ординату пересечения с осью Oy','value':'значение y при x=2'}[query]
            kl={'slope':'бұрыштық коэффициентін','intercept':'Oy осімен қиылысу ординатасын','value':'x=2 кезіндегі y мәнін'}[query]
            p(11,name,f'Для касательной к y={e} в точке x₀={at} найдите {label}.',f'y={e} графигіне x₀={at} нүктесінде жүргізілген жанаманың {kl} табыңыз.',ans,wrong,f'Находим f(x₀) и f′(x₀), записываем y=f(x₀)+f′(x₀)(x−x₀), затем выделяем нужную величину.',f'f(x₀) және f′(x₀) мәндерін табамыз, y=f(x₀)+f′(x₀)(x−x₀) теңдеуін жазып, қажетті шаманы анықтаймыз.','tangent',e,at=at,query=query,target=2)
        # 12: normalized primitive, linearity, determine additive constant.
        for name,e,at,initial,ans,wrong in [('initial',f'{2*a}*x',0,b,a+b,[a,b,2*a+b]),('linearity',f'{3*a}*x**2+{2*b}*x',0,0,a+b,[3*a+2*b,a+2*b,3*a+b]),('constant',f'{a}',2,b,b-a,[b+a,b-2*a,b])]:
            p(12,name,f'F′(x)={e}, F({at})={initial}. Найдите F(1).',f'F′(x)={e}, F({at})={initial}. F(1) мәнін табыңыз.',ans,wrong,'Интегрируем каждое слагаемое, добавляем C. Начальное значение определяет C; проверяем результат дифференцированием.','Әр мүшені интегралдап, C қосамыз. Бастапқы мән C тұрақтысын анықтайды; нәтижені туынды арқылы тексереміз.','primitive_value',e,at=at,initial=initial,target=1)
        # 13: power primitive coefficient, negative power, exponential chain factor.
        for name,e,ans,wrong,rule,rk in [('power',f'{a}*x**{b}',F(a,b+1),[a*(b+1),F(a,b),a],'При интегрировании x^m показатель увеличиваем на 1, коэффициент делим на m+1.','x^m интегралында көрсеткішті 1-ге арттырып, коэффициентті m+1 санына бөлеміз.'),('negative',f'{a}/x**2',-a,[a,F(-a,2),-2*a],'На x>0 интегрируем x^(−2): получаем −x^(−1); проверяем производной.','x>0 кезінде x^(−2) интегралы −x^(−1); туынды арқылы тексереміз.'),('exponential',f'{a}*exp({b}*x)',F(a,b),[a*b,a,F(b,a)],'Интеграл exp(kx) равен exp(kx)/k; коэффициент цепного правила проверяем производной.','exp(kx) интегралы exp(kx)/k; коэффициентті туынды арқылы тексереміз.')]:
            basis=f'x**{b+1}' if name=='power' else '1/x' if name=='negative' else f'exp({b}*x)'
            p(13,name,f'На x>0 найдите коэффициент K в первообразной K*({basis})+C для f(x)={e}.',f'x>0 кезінде f(x)={e} функциясының K*({basis})+C алғашқы функциясындағы K коэффициентін табыңыз.',ans,wrong,rule,rk,'primitive_coefficient',e,basis=basis)
        # 14: real component, imaginary product component, squared modulus.
        for name,e,component,ans,wrong,rule,rk in [('sum',f'({a}+{b}*I)+({c}-2*I)','real',a+c,[a-c,b-2,a+b+c-2],'При сложении комплексных чисел отдельно складываем действительные и мнимые части.','Комплекс сандарды қосқанда нақты және жорамал бөліктерін бөлек қосамыз.'),('product',f'({a}+I)*({b}-I)','imag',b-a,[a+b,a*b+1,a-b],'Раскрываем произведение с учётом i²=−1. Коэффициент при i равен b−a.','i²=−1 екенін ескеріп, көбейтіндіні ашамыз. i коэффициенті b−a-ға тең.'),('modulus',f'{a}+{b}*I','modulus_squared',a*a+b*b,[a+b,(a+b)**2,a*a-b*b],'Квадрат модуля a+bi равен a²+b²; оба квадрата неотрицательны.','a+bi модулінің квадраты a²+b²; екі квадрат та теріс емес.')]:
            label={'real':'действительную часть','imag':'мнимую часть','modulus_squared':'квадрат модуля'}[component]
            kl={'real':'нақты бөлігін','imag':'жорамал бөлігін','modulus_squared':'модулінің квадратын'}[component]
            p(14,name,f'При i²=−1 найдите {label} z={e.replace("I","i")}.',f'i²=−1 кезінде z={e.replace("I","i")} санының {kl} табыңыз.',ans,wrong,rule,rk,'complex',e,component=component)
        # 15: separate, integrate, apply IC, verify at a specified coordinate.
        for name,rhs,initial,solution,at,ans,wrong in [('linear',f'{a}*y',b,f'{b}*exp({a}*x)',1,f'{b}*exp({a})',[f'exp({a})+{b}',f'{b}*exp(-{a})',f'{b}*exp({2*a})']),('quadratic',f'{2*a}*x*y',b,f'{b}*exp({a}*x**2)',2,f'{b}*exp({4*a})',[f'{b}*exp({2*a})',f'{b}*exp({a})',f'{b}*exp(-{4*a})']),('additive',f'{2*a}*x+{b}',c,f'{a}*x**2+{b}*x+{c}',1,a+b+c,[a+b,a+c,2*a+b+c])]:
            integral=f'{a}*x' if name=='linear' else f'{a}*x**2'
            rule=(f'Начальное значение {initial}>0. Разделяем: dy/y=({rhs.replace("*y", "")})dx. Интегрируем: ln|y|={integral}+C, y=C1*exp({integral}). Из y(0)={initial} получаем C1={initial}.' if name!='additive' else f'Интегрируем y′={rhs}: y={a}*x**2+{b}*x+C. Из y(0)={initial} получаем C={initial}.')
            rk=(f'Бастапқы мән {initial}>0. Айнымалыларды ажыратамыз: dy/y=({rhs.replace("*y", "")})dx. Интегралдаймыз: ln|y|={integral}+C, y=C1*exp({integral}). y(0)={initial} шартынан C1={initial}.' if name!='additive' else f'y′={rhs} теңдеуін интегралдаймыз: y={a}*x**2+{b}*x+C. y(0)={initial} шартынан C={initial}.')
            p(15,name,f'Решение y′={rhs}, y(0)={initial} определено на R. Найдите y({at}).',f'y′={rhs}, y(0)={initial} шешімі R жиынында анықталған. y({at}) мәнін табыңыз.',ans,wrong,rule+f' Получаем y={solution}; подставляем x={at}.',rk+f' y={solution}; x={at} мәнін қоямыз.','ode_first',rhs,initial=initial,solution=solution,at=at)
        # 16: distinct, repeated and imaginary characteristic roots.
        for name,coefs,y0,dy0,sol,at,ans,wrong in [('distinct',[1,0,-a*a],2,0,f'exp({a}*x)+exp(-{a}*x)',1,f'exp({a})+exp(-{a})',[f'2*exp({a})',f'exp({a})-exp(-{a})',f'2*exp(-{a})']),('repeated',[1,-2*a,a*a],1,a+b,f'(1+{b}*x)*exp({a}*x)',1,f'{b+1}*exp({a})',[f'exp({a})',f'{b-1}*exp({a})',f'{b+1}*exp(-{a})']),('oscillation',[1,0,a*a],b,0,f'{b}*cos({a}*x)',f'pi/{a}',-b,[b,0,a])]:
            p(16,name,f'Решите y″+({coefs[1]})y′+({coefs[2]})y=0, y(0)={y0}, y′(0)={dy0}. Найдите y({at}).',f'y″+({coefs[1]})y′+({coefs[2]})y=0, y(0)={y0}, y′(0)={dy0} теңдеуін шешіп, y({at}) мәнін табыңыз.',ans,wrong,f'Находим корни характеристического уравнения k²+({coefs[1]})k+({coefs[2]})=0. Начальные условия определяют константы: y={sol}. Проверяем обе производные и условия.',f'k²+({coefs[1]})k+({coefs[2]})=0 сипаттамалық теңдеуінің түбірлерін табамыз. Бастапқы шарттар тұрақтыларды анықтайды: y={sol}. Екі туындыны және шарттарды тексереміз.','ode_second',sol,coefficients=coefs,initial=[y0,dy0],at=at)
        # 17: surface formula, total surface, invert net circumference.
        for name,ru,kk,ans,wrong,e,rule,rk in [('lateral',f'Радиус цилиндра {a}, высота {b}. Найдите S_бок/π.',f'Цилиндр радиусы {a}, биіктігі {b}. S_бүйір/π табыңыз.',2*a*b,[a*b,a*a*b,2*a*(a+b)],f'2*pi*{a}*{b}/pi','S_бок=2πrh; подставляем радиус и высоту.','S_бүйір=2πrh; радиус пен биіктікті қоямыз.'),('total',f'Радиус цилиндра {a}, высота {b}. Найдите S_полн/π.',f'Цилиндр радиусы {a}, биіктігі {b}. S_толық/π табыңыз.',2*a*(a+b),[2*a*b,a*(a+b),a*a*b],f'(2*pi*{a}*{b}+2*pi*{a}**2)/pi','К боковой площади 2πrh добавляем площади двух оснований 2πr².','2πrh бүйір ауданына екі табанның 2πr² ауданын қосамыз.'),('net',f'Длина стороны развёртки цилиндра, равная окружности основания, {2*a}π. Найдите радиус.',f'Цилиндр жаймасының табан шеңберіне сәйкес қабырғасы {2*a}π. Радиусты табыңыз.',a,[2*a,F(a,2),a*a],f'{2*a}*pi/(2*pi)','Длина окружности равна 2πr; делим её на 2π.','Шеңбер ұзындығы 2πr; оны 2π-ге бөлеміз.')]:
            p(17,name,ru+' Все длины в см.',kk+' Барлық ұзындықтар см-мен берілген.',ans,wrong,rule,rk,'evaluate',e)
        # 18: Pythagorean slant, sector net, recover slant from area.
        for name,ru,kk,ans,wrong,e,rule,rk in [('slant',f'Прямой круговой конус имеет радиус {3*a}, высоту {4*a}. Найдите образующую.',f'Тік дөңгелек конус радиусы {3*a}, биіктігі {4*a}. Жасаушысын табыңыз.',5*a,[7*a,a,25*a*a],f'sqrt({3*a}**2+{4*a}**2)','Образующая — гипотенуза осевого прямоугольного треугольника: l²=r²+h².','Жасаушы осьтік тікбұрышты үшбұрыштың гипотенузасы: l²=r²+h².'),('sector',f'Развёртка конуса — сектор радиуса {a} с углом 120°. Найдите радиус основания.',f'Конус жаймасы — радиусы {a}, бұрышы 120° сектор. Табан радиусын табыңыз.',F(a,3),[a,3*a,F(a,6)],f'(120/360*2*pi*{a})/(2*pi)','Длина дуги сектора равна окружности основания: (120/360)·2πl=2πr.','Сектор доғасының ұзындығы табан шеңберінің ұзындығына тең: (120/360)·2πl=2πr.'),('inverse',f'Конус: радиус {a}, боковая площадь {a*b}π. Найдите образующую.',f'Конус радиусы {a}, бүйір ауданы {a*b}π. Жасаушысын табыңыз.',b,[a*b,F(b,2),a],f'{a*b}*pi/(pi*{a})','Из S_бок=πrl следует l=S_бок/(πr). l>r, конус невырожденный.','S_бүйір=πrl бойынша l=S_бүйір/(πr). l>r, конус азғындалмаған.')]:
            p(18,name,ru+' Длины в см, площади в см².',kk+' Ұзындықтар см, аудандар см².',ans,wrong,rule,rk,'evaluate',e)
        # 19: oblique prism, pyramid and frustum (not rotation bodies).
        p(18,'sector_total',f'Развёртка боковой поверхности прямого кругового конуса — сектор радиуса {3*a} см с углом 120°. Найдите S_полн/π в см².',f'Тік дөңгелек конустың бүйір бетінің жаймасы — радиусы {3*a} см, бұрышы 120° сектор. S_толық/π мәнін см² бірлігімен табыңыз.',4*a*a,[3*a*a,12*a*a,6*a*a],f'Дуга сектора (120/360)·2π·{3*a}={2*a}π равна 2πr, поэтому r={a}. Образующая l={3*a}. Полная площадь πr(l+r)=π·{a}·({3*a}+{a})={4*a*a}π.',f'Сектор доғасы (120/360)·2π·{3*a}={2*a}π және 2πr-ге тең, сондықтан r={a}. Жасаушы l={3*a}. Толық аудан πr(l+r)=π·{a}·({3*a}+{a})={4*a*a}π.','cone_net_total',f'120/360*2*pi*{3*a}',slant=3*a)
        for name,ru,kk,ans,wrong,e,rule,rk in [('prism',f'Площадь основания наклонной призмы {a}, перпендикулярная высота {b}, боковое ребро {b+2}. Найдите объём.',f'Көлбеу призманың табан ауданы {a}, перпендикуляр биіктігі {b}, бүйір қыры {b+2}. Көлемін табыңыз.',a*b,[a*(b+2),F(a*b,3),a+b],f'{a}*{b}','V=S_осн·h; используется перпендикулярная высота, а не боковое ребро.','V=S_табан·h; бүйір қыры емес, перпендикуляр биіктік қолданылады.'),('pyramid',f'Площадь основания пирамиды {3*a}, высота {b}. Найдите объём.',f'Пирамида табанының ауданы {3*a}, биіктігі {b}. Көлемін табыңыз.',a*b,[3*a*b,a*b+1,a+b],f'{3*a}*{b}/3','Объём пирамиды составляет треть произведения площади основания на высоту.','Пирамида көлемі табан ауданы мен биіктігінің көбейтіндісінің үштен біріне тең.'),('frustum',f'Усечённая пирамида имеет площади оснований {a*a} и {b*b}, высоту 3. Найдите объём.',f'Қиық пирамиданың табан аудандары {a*a} және {b*b}, биіктігі 3. Көлемін табыңыз.',a*a+a*b+b*b,[a*a+b*b,3*(a*a+b*b),a*b],f'3*({a*a}+{b*b}+sqrt({a*a}*{b*b}))/3','Используем V=h(S₁+S₂+sqrt(S₁S₂))/3; площади положительны.','V=h(S₁+S₂+sqrt(S₁S₂))/3 формуласын қолданамыз; аудандар оң.')]:
            p(19,name,ru+' Единицы: см, см², см³.',kk+' Өлшем бірліктері: см, см², см³.',ans,wrong,rule,rk,'evaluate',e)
        # 20: diameter to radius, slant to height, rotation frustum.
        for name,ru,kk,ans,wrong,e,rule,rk in [('cylinder',f'Диаметр цилиндра {2*a}, высота {b}. Найдите V/π.',f'Цилиндр диаметрі {2*a}, биіктігі {b}. V/π табыңыз.',a*a*b,[4*a*a*b,2*a*a*b,F(a*a*b,3)],f'pi*({2*a}/2)**2*{b}/pi','Сначала радиус d/2, затем V=πr²h.','Алдымен радиус d/2, кейін V=πr²h.'),('cone',f'Радиус прямого конуса {3*a}, образующая {5*a}. Найдите V/π.',f'Тік конус радиусы {3*a}, жасаушысы {5*a}. V/π табыңыз.',12*a**3,[36*a**3,15*a**3,4*a*a],f'pi*{3*a}**2*sqrt({5*a}**2-{3*a}**2)/3/pi',f'Высота h=sqrt({5*a}²−{3*a}²)={4*a}. Затем V/π={3*a}²·{4*a}/3={12*a**3}; не подставляем образующую вместо высоты.',f'Биіктік h=sqrt({5*a}²−{3*a}²)={4*a}. Кейін V/π={3*a}²·{4*a}/3={12*a**3}; биіктіктің орнына жасаушыны қоймаймыз.'),('frustum',f'Радиусы усечённого конуса {b} и {a}, высота {c}. Найдите V/π.',f'Қиық конус радиустары {b} және {a}, биіктігі {c}. V/π табыңыз.',F(c*(a*a+a*b+b*b),3),[F(c*(a*a+b*b),3),c*b*b,c*(a*a+a*b+b*b)],f'pi*{c}*({b}**2+{a}*{b}+{a}**2)/3/pi','Применяем V=πh(R²+Rr+r²)/3; проверяем R>r>0 и h>0.','V=πh(R²+Rr+r²)/3 формуласын қолданамыз; R>r>0 және h>0 шарттарын тексереміз.')]:
            p(20,name,ru+' Единицы: см и см³.',kk+' Өлшем бірліктері: см және см³.',ans,wrong,rule,rk,'evaluate',e)
    return rows


if __name__ == '__main__':
    count = int(sys.argv[1]) if len(sys.argv)>1 else 44
    if not 1 <= count <= 44:
        raise ValueError('Reviewed parameter range: 1..44 variants per family')
    bank = generate(count)
    verify(bank)
    json.dump(bank, sys.stdout, ensure_ascii=False, indent=2)
