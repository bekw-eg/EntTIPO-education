import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, copyFile, readdir } from "node:fs/promises";
import path from "node:path";

async function main() {
  const dir = "public/offline-assets";
  const katexVersion = JSON.parse(await readFile("node_modules/katex/package.json", "utf8")).version;
  const katexDir = `${dir}/katex-${katexVersion}`;
  await mkdir(`${katexDir}/fonts`, { recursive: true });
  const bundle = await build({ entryPoints: ["lib/offline/client.ts"], bundle: true, write: false,
    platform: "browser", target: "es2020", format: "iife", minify: true });
  const bytes = bundle.outputFiles[0].contents;
  const hash = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");
  const mark = await readFile("public/brand/synaq-mark.svg");
  const markName = `synaq-mark-${hash(mark).slice(0, 16)}.svg`;
  await writeFile(`${dir}/${markName}`, mark);
  const jsName = `practice-${hash(bytes).slice(0, 16)}.js`;
  await writeFile(`${dir}/${jsName}`, bytes);
  await copyFile("node_modules/katex/dist/katex.min.css", `${katexDir}/katex.min.css`);
  const fonts = await readdir("node_modules/katex/dist/fonts");
  for (const font of fonts) await copyFile(`node_modules/katex/dist/fonts/${font}`, `${katexDir}/fonts/${font}`);
  const html = (await readFile("scripts/offline-shell.html", "utf8")).replace("__CLIENT_JS__", `/offline-assets/${jsName}`).replace("__KATEX_DIR__", `/offline-assets/katex-${katexVersion}`).replace("__SYNAQ_MARK__", `/offline-assets/${markName}`);
  const shellName = `shell-${hash(html).slice(0, 16)}.html`;
  await writeFile(`${dir}/${shellName}`, html);
  await writeFile("public/offline-practice.html", html);
  const urls = [`/offline-assets/${shellName}`, `/offline-assets/${jsName}`, `/offline-assets/${markName}`, `/offline-assets/katex-${katexVersion}/katex.min.css`, ...fonts.map(font => `/offline-assets/katex-${katexVersion}/fonts/${font}`)];
  const files = await Promise.all(urls.map(async url => {
    const content = await readFile(path.join("public", url));
    return { url, bytes: content.byteLength, sha256: hash(content) };
  }));
  await writeFile(`${dir}/manifest.json`, JSON.stringify({ version: hash(JSON.stringify(files)), files }));
  console.log(`Offline shell built: ${files.length} verified assets, ${files.reduce((sum, f) => sum + f.bytes, 0)} bytes`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
