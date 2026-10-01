# Geração de imagens — Nano Banana Pro

Documento técnico interno. Nada daqui aparece na conversa com o cliente.

Modelo: `gemini-3-pro-image-preview` (Nano Banana Pro).
Quem executa: o **Editor**. O Content Multiplier usa o mesmo caminho na fase pós-entrega.

---

## Quando gerar

Só depois de:

1. Key Visual aprovado pelo cliente.
2. Copys aprovadas pelo cliente.
3. Lista de peças aprovada **peça a peça**.

**Gere exclusivamente as peças aprovadas.** Se o cliente aprovou 6 de 9, gere 6. Peça em revisão espera. Se houver qualquer dúvida sobre o status de uma peça, pergunte antes de gerar, uma pergunta só.

---

## Dois caminhos de execução

### Caminho A — ferramenta nativa de imagem do ambiente

Se o ambiente já oferecer geração de imagem nativa (Gemini CLI com geração de imagem habilitada, Antigravity, ou equivalente), use-a diretamente, uma chamada por peça, e salve o arquivo em `Projetos/<Cliente>/<Campanha>/resultados/imagens/` com o nome padronizado abaixo. Se a ferramenta salvar em outro lugar, mova o arquivo para a pasta correta.

### Caminho B — lote pelo script (padrão para volume)

Monte um arquivo de lote e rode o script. É o caminho preferido quando há mais de duas peças, porque garante consistência de referência, nomes, formato e log.

**1. Escreva o lote** em `Projetos/<Cliente>/<Campanha>/resultados/lote-imagens.json`:

```json
{
  "saida": "Projetos/<Cliente>/<Campanha>/resultados/imagens",
  "modelo": "gemini-3-pro-image-preview",
  "referencias": ["Projetos/<Cliente>/<Campanha>/resultados/imagens/00-kv.png"],
  "resolucao": "2K",
  "pecas": [
    {
      "id": "01-feed-cover",
      "proporcao": "4:5",
      "prompt": "prompt completo em inglês, autossuficiente"
    },
    {
      "id": "02-feed-slide-2",
      "proporcao": "4:5",
      "prompt": "..."
    }
  ]
}
```

**2. Rode:**

```bash
node ferramentas/gerar-imagens.mjs "Projetos/<Cliente>/<Campanha>/resultados/lote-imagens.json"
```

Flags: `--force` regera o que já existe, `--only=01-feed-cover,03-stories` gera um subconjunto (use para refação de peça específica).

**3. Confira o resultado** em `resultados/imagens/_log-geracao.json` e reporte ao cliente o que saiu e o que falhou.

---

## Campos do lote

| Campo | Onde | Valor |
|---|---|---|
| `saida` | lote | pasta de imagens do projeto |
| `modelo` | lote | `gemini-3-pro-image-preview` |
| `referencias` | lote | imagens herdadas por todas as peças (o KV aprovado, e referências de marca) |
| `resolucao` | lote ou peça | `1K`, `2K` ou `4K`. Padrão `2K` |
| `id` | peça | vira o nome do arquivo |
| `proporcao` | peça | `1:1`, `4:5`, `9:16`, `16:9`, `2:3`, `3:2`, `3:4`, `4:3`, `5:4`, `21:9` |
| `prompt` | peça | inglês, autossuficiente |
| `referencias` | peça | referências extras só daquela peça |

O script aceita até o limite do modelo em imagens de referência por chamada. Passar o KV aprovado em `referencias` do lote é o que mantém o enxoval visualmente coerente. Não pule isso.

---

## Nomenclatura dos arquivos

`<ordem>-<canal>-<peça>.png`, **sempre em inglês**, minúsculo, sem acento e sem espaço, em qualquer atendimento. Um idioma só aqui mantém os caminhos estáveis e deixa a lista de entrega legível para cliente de fora.

```
00-kv.png
01-feed-cover.png
02-feed-slide-2.png
03-feed-slide-3.png
04-feed-cta.png
05-stories-01.png
06-ad-16x9.png
```

---

## Texto dentro da imagem

Regra da marca, herdada de `imagens.md`: **o prompt não pede texto dentro da imagem.** Modelo de imagem erra acento, quebra kerning e trunca palavra em português.

Portanto:

- O prompt gera a arte limpa e **reserva explicitamente a área vazia** onde o texto vai entrar.
- Junto de cada peça gerada, o Editor entrega o bloco de texto correspondente para a aplicação por cima, no idioma do cliente:

  > **Tem texto em cima.**
  > Área reservada: [onde ficou o espaço vazio]
  > Texto exato: [título / apoio / CTA, entre aspas]
  > Tipografia: [fonte, peso, caixa, alinhamento]

  > **Text goes on top.**
  > Reserved area: [where the empty space sits]
  > Exact copy: [headline / support / CTA, in quotes]
  > Type: [typeface, weight, case, alignment]

- Se a peça não tem texto, diga isso em uma linha.

Exceção: se o cliente pedir expressamente o texto renderizado dentro da imagem, avise em uma linha o risco de erro de acentuação e faça como ele pediu.

---

## Falhas comuns

| Sintoma | Causa | O que fazer |
|---|---|---|
| `HTTP 429 ... limit: 0` | chave sem billing ativo para o modelo de imagem | avisar o cliente que a geração está bloqueada por cota e entregar os prompts prontos enquanto isso |
| `HTTP 400` em `imageConfig` | versão do modelo sem suporte a proporção/resolução | o script já tenta de novo sem `imageConfig`; a proporção então vem do texto do prompt |
| `resposta sem imagem (...)` | prompt bloqueado por política | reescrever a cena, sem citar pessoa real, marca de terceiro ou conteúdo sensível |
| `referência não encontrada` | caminho do KV errado | conferir se o KV foi realmente salvo em `resultados/imagens/` |
| chave ausente | `GEMINI_API_KEY` não definida | pedir ao cliente para definir a variável de ambiente |

Falha em uma peça não interrompe o lote. Ao final, reporte com honestidade o que foi gerado e o que não foi.
