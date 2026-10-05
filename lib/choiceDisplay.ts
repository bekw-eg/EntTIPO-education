/** Authored expressions only; rendering is independent of answer checking. */
export function choiceLatex(value: string): string {
  let text = value.replace(/\*\*/g, "^").replace(/−/g, "-").replace(/π|\bpi\b/g, "\\pi")
    .replace(/√(\d+)/g, "\\sqrt{$1}").replace(/±/g, "\\pm ").replace(/∪/g, "\\cup ")
    .replace(/²/g, "^{2}").replace(/³/g, "^{3}").replace(/⁴/g, "^{4}").replace(/₀/g, "_0").replace(/₁/g, "_1").replace(/₂/g, "_2")
    .replace(/≠/g, "\\ne ").replace(/≤/g, "\\le ").replace(/≥/g, "\\ge ")
    .replace(/∈/g, "\\in ").replace(/\bR\b/g, "\\mathbb{R}").replace(/′/g, "'").replace(/″/g, "''").replace(/°/g, "^{\\circ}");
  text = text.replace(/ln\(abs\(([^()]+)\)\)\)/g, "\\ln|$1|");
  text = text.replace(/√\(/g, "sqrt(");
  text = formatCalls(text, "sqrt", argument => `\\sqrt{${argument}}`);
  text = formatCalls(text, "exp", argument => `e^{${argument}}`);
  text = text.replace(/\^\(([^()]+)\)/g, "^{$1}").replace(/\^(\d+)/g, "^{$1}")
    .replace(/(?<!\\)\b(sin|cos|tan|arcsin|arccos|arctan|ln)\b/g, "\\$1")
    .replace(/\blog_([A-Za-z0-9]+)/g, "\\log_{$1}")
    .replace(/\*/g, "\\cdot ").replace(/C([12])/g, "C_$1");
  return text.replace(/^\{(.*)\}$/, "\\{$1\\}");
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
    part.replace(/[^\p{Script=Cyrillic}$]+/gu, span => {
      if (!/[A-Za-z0-9π√]/.test(span)) return span;
      const leading = span.match(/^[\s.,:!?—«»]+/)?.[0] ?? "";
      const trailing = span.match(/[\s.,:!?—«»]+$/)?.[0] ?? "";
      const expression = span.slice(leading.length, trailing.length ? -trailing.length : undefined);
      return expression ? `${leading}$${choiceLatex(expression)}$${trailing}` : span;
    })).join("");
}
