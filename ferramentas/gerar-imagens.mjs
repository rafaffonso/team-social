#!/usr/bin/env node
/**
 * Gerador de imagens — Nano Banana Pro (Gemini API)
 *
 * Uso:
 *   node ferramentas/gerar-imagens.mjs <caminho/do/lote.json> [--force] [--only=id1,id2]
 *
 * Requer a variável de ambiente GEMINI_API_KEY (ou GOOGLE_API_KEY).
 * Sem dependências externas: usa apenas Node 18+ (fetch nativo).
 *
 * Formato do lote.json:
 * {
 *   "saida": "Projetos/Marca/Campanha/resultados/imagens",
 *   "modelo": "gemini-3-pro-image-preview",
 *   "referencias": ["Projetos/Marca/Campanha/resultados/imagens/00-kv.png"],
 *   "pecas": [
 *     {
 *       "id": "01-feed-capa",
 *       "proporcao": "4:5",
 *       "resolucao": "2K",
 *       "prompt": "prompt completo em inglês, autossuficiente",
 *       "referencias": ["caminho/opcional/extra.png"]
 *     }
 *   ]
 * }
 */

import fs from "node:fs/promises";
import path from "node:path";

const MODELO_PADRAO = "gemini-3-pro-image-preview";
const PROPORCOES = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
const RESOLUCOES = ["1K", "2K", "4K"];
const CONCORRENCIA = 2;
const TENTATIVAS = 3;

const args = process.argv.slice(2);
const arquivoLote = args.find((a) => !a.startsWith("--"));
const force = args.includes("--force");
const only = (args.find((a) => a.startsWith("--only=")) || "").replace("--only=", "");
const filtro = only ? new Set(only.split(",").map((s) => s.trim())) : null;

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

function morrer(msg) {
  console.error(`\nERRO: ${msg}\n`);
  process.exit(1);
}

if (!arquivoLote) morrer("informe o caminho do lote.json.\nExemplo: node ferramentas/gerar-imagens.mjs Projetos/Marca/Campanha/resultados/lote-imagens.json");
if (!apiKey) morrer("GEMINI_API_KEY (ou GOOGLE_API_KEY) não está definida no ambiente.");

const raiz = process.cwd();
const lotePath = path.resolve(raiz, arquivoLote);
const loteDir = path.dirname(lotePath);

let lote;
try {
  lote = JSON.parse(await fs.readFile(lotePath, "utf8"));
} catch (e) {
  morrer(`não consegui ler o lote em ${lotePath}: ${e.message}`);
}

const modelo = lote.modelo || MODELO_PADRAO;
const saida = path.resolve(raiz, lote.saida || path.join(path.dirname(arquivoLote), "imagens"));
const pecas = (lote.pecas || []).filter((p) => !filtro || filtro.has(p.id));

if (!pecas.length) morrer("nenhuma peça para gerar (verifique 'pecas' no lote ou o filtro --only).");

await fs.mkdir(saida, { recursive: true });

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

async function carregarReferencia(ref) {
  const candidatos = [path.resolve(raiz, ref), path.resolve(loteDir, ref), path.resolve(saida, ref)];
  for (const c of candidatos) {
    try {
      const buf = await fs.readFile(c);
      const mime = MIME[path.extname(c).toLowerCase()];
      if (!mime) throw new Error(`formato de referência não suportado: ${path.extname(c)}`);
      return { inlineData: { mimeType: mime, data: buf.toString("base64") } };
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  throw new Error(`referência não encontrada: ${ref}`);
}

function extensaoPor(mime) {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  return ".png";
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function chamar(corpo) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(corpo),
  });
  const texto = await resp.text();
  if (!resp.ok) {
    const err = new Error(`HTTP ${resp.status}: ${texto.slice(0, 400)}`);
    err.status = resp.status;
    err.body = texto;
    throw err;
  }
  return JSON.parse(texto);
}

async function gerarPeca(peca) {
  const id = peca.id || `peca-${Math.random().toString(36).slice(2, 8)}`;
  if (!peca.prompt || !peca.prompt.trim()) throw new Error(`peça ${id} está sem prompt.`);

  const proporcao = peca.proporcao || lote.proporcao || "4:5";
  if (!PROPORCOES.includes(proporcao)) throw new Error(`proporção inválida em ${id}: ${proporcao}`);
  const resolucao = peca.resolucao || lote.resolucao || "2K";
  if (!RESOLUCOES.includes(resolucao)) throw new Error(`resolução inválida em ${id}: ${resolucao}`);

  const refs = [...(lote.referencias || []), ...(peca.referencias || [])];
  const partes = [];
  for (const ref of refs) partes.push(await carregarReferencia(ref));
  partes.push({ text: peca.prompt });

  const corpoBase = {
    contents: [{ role: "user", parts: partes }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: proporcao, imageSize: resolucao },
    },
  };

  let dados = null;
  let ultimoErro = null;
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const corpo = JSON.parse(JSON.stringify(corpoBase));
      // Se a API recusar imageConfig (versão mais antiga do modelo), tenta sem ele.
      if (tentativa > 1 && ultimoErro?.status === 400) delete corpo.generationConfig.imageConfig;
      const json = await chamar(corpo);
      const cand = json?.candidates?.[0];
      const parte = (cand?.content?.parts || []).find((p) => p.inlineData?.data);
      if (!parte) {
        const motivo = cand?.finishReason || json?.promptFeedback?.blockReason || "sem imagem na resposta";
        throw new Error(`resposta sem imagem (${motivo})`);
      }
      dados = parte.inlineData;
      break;
    } catch (e) {
      ultimoErro = e;
      const recuperavel = [429, 500, 502, 503, 504].includes(e.status) || e.status === 400;
      if (tentativa === TENTATIVAS || !recuperavel) throw e;
      await dormir(1500 * tentativa);
    }
  }

  const arquivo = path.join(saida, `${id}${extensaoPor(dados.mimeType)}`);
  await fs.writeFile(arquivo, Buffer.from(dados.data, "base64"));
  return { id, arquivo, proporcao, resolucao, referencias: refs };
}

console.log(`\nModelo: ${modelo}`);
console.log(`Pasta de saída: ${saida}`);
console.log(`Peças na fila: ${pecas.length}${force ? " (--force: regerando tudo)" : ""}\n`);

const ok = [];
const falhas = [];
const fila = [...pecas];

async function worker() {
  while (fila.length) {
    const peca = fila.shift();
    const id = peca.id;
    const jaExiste = await fs
      .access(path.join(saida, `${id}.png`))
      .then(() => true)
      .catch(() => false);
    if (jaExiste && !force) {
      console.log(`  · ${id} — já existe, pulando (use --force para regerar)`);
      ok.push({ id, arquivo: path.join(saida, `${id}.png`), pulado: true });
      continue;
    }
    try {
      const r = await gerarPeca(peca);
      console.log(`  ok ${r.id} -> ${path.relative(raiz, r.arquivo)}`);
      ok.push(r);
    } catch (e) {
      console.log(`  falhou ${id} — ${e.message}`);
      falhas.push({ id, erro: e.message });
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, pecas.length) }, worker));

const log = {
  executadoEm: new Date().toISOString(),
  modelo,
  lote: path.relative(raiz, lotePath),
  saida: path.relative(raiz, saida),
  geradas: ok.map((r) => ({ id: r.id, arquivo: path.relative(raiz, r.arquivo), pulado: !!r.pulado })),
  falhas,
};
await fs.writeFile(path.join(saida, "_log-geracao.json"), JSON.stringify(log, null, 2));

console.log(`\nGeradas: ${ok.length}   Falhas: ${falhas.length}`);
console.log(`Log: ${path.relative(raiz, path.join(saida, "_log-geracao.json"))}\n`);
process.exit(falhas.length ? 1 : 0);
