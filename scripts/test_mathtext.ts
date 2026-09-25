import katex from 'katex';

function testLine(line: string) {
  if (line.includes('$')) {
    const parts = line.split(/(\$[^$]+\$)/g);
    for (const part of parts) {
      if (part.startsWith('$') && part.endsWith('$')) {
        const math = part.slice(1, -1);
        const res = katex.renderToString(math, { throwOnError: true, displayMode: false });
        console.log('Inline math OK:', math, '->', res.length, 'chars');
      }
    }
  } else {
    const res = katex.renderToString(line, { throwOnError: true, displayMode: false });
    console.log('Formula line OK:', line, '->', res.length, 'chars');
  }
}

const sampleT1 = [
  '2^3 = 8',
  '\\sqrt{9} = 3',
  '27^{2/3} = (\\sqrt[3]{27})^2 = 3^2 = 9'
];

sampleT1.forEach(testLine);
