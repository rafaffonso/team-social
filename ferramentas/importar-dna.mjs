#!/usr/bin/env node
/**
 * Importa um DNA gerado pelo "DNA" para dentro do Team Social.
 *
 * Uso:
 *   node ferramentas/importar-dna.mjs <slug-do-projeto-dna> [--como "NomeDoCliente"] [--force]
 *
 * Exemplo:
 *   node ferramentas/importar-dna.mjs minha-marca --como "MinhaMarca"
 *
 * O que faz:
 *   dna/projetos/<slug>/resultado/DNA.md  ->  Projetos/<Cliente>/DNA.md
 *   .../resultado/prompts.md                                    ->  Projetos/<Cliente>/referencias/prompts-dna.md
 *   .../referencias/**                                          ->  Projetos/<Cliente>/referencias/
 *   .../.brand.json                                             ->  Projetos/<Cliente>/.brand.json
 *
 * Não sobrescreve um DNA já existente sem --force.
 */

import fs from "node:fs/promises";
import path from "node:path";

const PASTA_DNA = "dna";

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const force = args.includes("--force");
const comoArg = args.find((a) => a.startsWith("--como="));
let como = comoArg ? comoArg.replace("--como=", "") : null;
const comoIdx = args.indexOf("--como");
if (!como && comoIdx !== -1 && args[comoIdx + 1]) como = args[comoIdx + 1];

function morrer(msg) {
  console.error(`\nERRO: ${msg}\n`);
  process.exit(1);
}

if (!slug) {
  morrer(
    'informe o slug do projeto de DNA.\nExemplo: node ferramentas/importar-dna.mjs minha-marca --como "MinhaMarca"'
  );
}

const raiz = process.cwd();
const origem = path.resolve(raiz, PASTA_DNA, "projetos", slug);

try {
  await fs.access(origem);
} catch {
  const base = path.resolve(raiz, PASTA_DNA, "projetos");
  let lista = [];
  try {
    lista = (await fs.readdir(base, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {}
  morrer(`projeto de DNA não encontrado: ${slug}\nDisponíveis: ${lista.join(", ") || "nenhum"}`);
}

// Nome do cliente: --como, ou brand_name do .brand.json, ou o próprio slug.
let brand = null;
try {
  brand = JSON.parse(await fs.readFile(path.join(origem, ".brand.json"), "utf8"));
} catch {}
const cliente = como || brand?.brand_name?.replace(/[\\/:*?"<>|]/g, "").trim() || slug;

const destino = path.resolve(raiz, "Projetos", cliente);
const destRefs = path.join(destino, "referencias");

const existe = (p) => fs.access(p).then(() => true).catch(() => false);

// "resultado"/"referencias" são os nomes canônicos. "results"/"references" aparecem em
// projetos antigos conduzidos em inglês, quando o agente traduzia o nome da pasta.
async function primeiraQueExiste(nomes) {
  for (const nome of nomes) {
    const p = path.join(origem, nome);
    if (await existe(p)) return p;
  }
  return null;
}

const dirResultado = await primeiraQueExiste(["resultado", "results", "dna-criativo"]);
if (!dirResultado) morrer(`o projeto ${slug} não tem pasta de resultado. Gere o DNA antes de importar.`);

const dnaOrigem = path.join(dirResultado, "DNA.md");
if (!(await existe(dnaOrigem))) {
  morrer(`o projeto ${slug} ainda não tem DNA.md gerado. Gere o DNA antes de importar.`);
}

const dnaDestino = path.join(destino, "DNA.md");
const jaTem = await fs
  .access(dnaDestino)
  .then(() => true)
  .catch(() => false);
if (jaTem && !force) {
  morrer(`já existe um DNA em Projetos/${cliente}/DNA.md. Use --force para sobrescrever.`);
}

await fs.mkdir(destRefs, { recursive: true });

const copiados = [];

await fs.copyFile(dnaOrigem, dnaDestino);
copiados.push(`DNA.md`);

const promptsOrigem = path.join(dirResultado, "prompts.md");
if (await existe(promptsOrigem)) {
  await fs.copyFile(promptsOrigem, path.join(destRefs, "prompts-dna.md"));
  copiados.push(`referencias/prompts-dna.md`);
}

const pdfOrigem = path.join(dirResultado, "DNA.pdf");
if (await existe(pdfOrigem)) {
  await fs.copyFile(pdfOrigem, path.join(destino, "DNA.pdf"));
  copiados.push(`DNA.pdf`);
}

const refsOrigem = await primeiraQueExiste(["referencias", "references", "materiais"]);
if (refsOrigem) {
  await fs.cp(refsOrigem, destRefs, { recursive: true, force: true });
  copiados.push(`referencias/ (material de marca)`);
}

if (brand) {
  await fs.writeFile(path.join(destino, ".brand.json"), JSON.stringify(brand, null, 2));
  copiados.push(`.brand.json`);
}

console.log(`\nDNA importado para Projetos/${cliente}/\n`);
for (const c of copiados) console.log(`  · ${c}`);

const idioma = brand?.content_language;
console.log(
  `\nIdioma de publicação: ${idioma ? idioma : "não declarado no .brand.json (confira a seção 4.13 do DNA.md)"}`
);
console.log(
  `\nAtenção: referencias/persona/ contém fotos de banco de imagem para ilustrar persona.`
);
console.log(`Não use essas fotos como referência de estilo visual da marca.\n`);
