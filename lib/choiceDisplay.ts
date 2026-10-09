/** Authored expressions only; rendering is independent of answer checking. */
export function choiceLatex(value: string): string {
  const fraction = outerFraction(value);
  if (fraction) return `\\frac{${choiceLatex(fraction[0])}}{${choiceLatex(fraction[1])}}`;
  let text = value.replace(/\*\*/g, "^").replace(/−/g, "-").replace(/π(?=[A-Za-z])/g, "\\pi ").replace(/π|(?<!\\)\bpi\b/g, "\\pi")
    .replace(/√(\d+)/g, "\\sqrt{$1}").replace(/±/g, "\\pm ").replace(/∪/g, "\\cup ")
    .replace(/²/g, "^{2}").replace(/³/g, "^{3}").replace(/⁴/g, "^{4}").replace(/₀/g, "_0").replace(/₁/g, "_1").replace(/₂/g, "_2")
    .replace(/≠/g, "\\ne ").replace(/≤/g, "\\le ").replace(/≥/g, "\\ge ")
    .replace(/∈/g, "\\in ").replace(/\bR\b/g, "\\mathbb{R}").replace(/′/g, "'").replace(/″/g, "''").replace(/°/g, "^{\\circ}");
  text = text.replace(/ln\(abs\(([^()]+)\)\)\)/g, "\\ln|$1|");
  text = text.replace(/_(?:\{([\p{Script=Cyrillic}]+)\}|([\p{Script=Cyrillic}]+))/gu, (_, braced, plain) => `_{\\text{${braced ?? plain}}}`);
  text = text.replace(/√\(/g, "sqrt(");
  text = formatCalls(text, "sqrt", argument => `\\sqrt{${argument}}`);
  text = formatCalls(text, "exp", argument => `e^{${argument}}`);
  text = formatCalls(text, "log_", argument => `\\log_{${choiceLatex(argument)}}`);
  text = formatCalls(text, "^", argument => `^{${choiceLatex(argument)}}`);
  text = text.replace(/\^\(([^()]+)\)/g, "^{$1}").replace(/\^(\d+)/g, "^{$1}")
    .replace(/(?<!\\)\b(sin|cos|tan|arcsin|arccos|arctan|ln)\b/g, "\\$1")
    .replace(/\blog_([A-Za-z0-9]+)/g, "\\log_{$1}")
    .replace(/(\d+(?:\.\d+)?)\s*\*\s*(?=[a-zA-Z(])/g, (match, coefficient: string, offset: number, source: string) =>
      source.slice(0, offset).includes("/") || /\^\s*$/.test(source.slice(0, offset)) ? match : coefficient)
    .replace(/\*/g, "\\cdot ").replace(/C([12])/g, "C_$1");
  return text.replace(/^\{(.*)\}$/, "\\{$1\\}");
}

/** Only a complete quotient is stacked; never change the precedence of a sum. */
function outerFraction(value: string): [string, string] | undefined {
  const text = value.trim();
  if (text.includes("\\")) return undefined; // Preserve authored LaTeX commands.
  let depth = 0, slash = -1;
  for (let i = 0; i < text.length; i++) {
    if ("({[".includes(text[i])) depth++;
    else if (")}]".includes(text[i])) depth--;
    else if (depth === 0) {
      if (text[i] === "/") { if (slash !== -1) return undefined; slash = i; }
      else if (slash !== -1 && /[*·×]/.test(text[i])) return undefined;
      else if (/[+=<>;,]/.test(text[i]) || (/[−-]/.test(text[i]) && i > 0)) return undefined;
    }
  }
  if (depth !== 0 || slash <= 0 || slash === text.length - 1) return undefined;
  return [text.slice(0, slash).trim(), text.slice(slash + 1).trim()];
}

function formatCalls(text: string, name: string, render: (argument: string) => string): string {
  // Balanced arguments preserve nested roots/exponents; no expression evaluation is involved.
  let start = text.lastIndexOf(`${name}(`);
  while (start >= 0) {
    let depth = 1, end = start + name.length + 1;
    for (; end < text.length && depth; end++) {
      if (text[end] === "(") depth++;
      if (text[end] === ")") depth--;
    }
    if (depth) break;
    const argument = text.slice(start + name.length + 1, end - 1);
    text = text.slice(0,start) + render(argument) + text.slice(end);
    start = text.lastIndexOf(`${name}(`);
  }
  return text;
}

/** RU/KK authored stems: mark mathematical spans, retaining prose and existing math/diagrams. */
export function choiceStem(value: string): string {
  return value.split(/(\$[^$]+\$|\[GEOMETRY:[\s\S]*?\])/g).map(part => part.startsWith("$") || part.startsWith("[GEOMETRY:") ? part :
    // A Cyrillic subscript is part of the formula, not the surrounding prose.
    part.replace(/(?:_(?:\{[\p{Script=Cyrillic}]+\}|[\p{Script=Cyrillic}]+)|[^\p{Script=Cyrillic}$])+/gu, span => {
      if (!/[A-Za-z0-9π√]/.test(span)) return span;
      const leading = span.match(/^[\s.,:!?—«»]+/)?.[0] ?? "";
      const trailing = span.match(/[\s.,:!?—«»]+$/)?.[0] ?? "";
      const expression = span.slice(leading.length, trailing.length ? -trailing.length : undefined);
      return expression ? `${leading}$${choiceLatex(expression)}$${trailing}` : span;
    })).join("");
}
