# team-social

A workflow of 10 specialized AI agent roles for social content, from reading a brand's DNA to delivering approved pieces. One Claude plays each role in turn within the same conversation, so the brand DNA stays in context throughout. It runs in [Claude Code](https://claude.com/claude-code) or in Gemini (Antigravity), and a person approves every step that matters.

## How it works

You start with a request, such as "I need a LinkedIn carousel about AI tone of voice for next week". The Orchestrator introduces the team and the work moves through the agents in order:

```
Orchestrator > DNA Analyst > Scout > Planner > Creative Director > Writer > Editor > Content Multiplier
```

Social Media Lead is a shortcut that does the Writer and Editor steps in one agent.

### Three approval gates

1. **DNA gate.** Before anything is created, the team reads the brand DNA in full and tells you in 5 to 8 lines what it understood. A brand without a DNA gets a full extraction first, even if you only want a few posts.
2. **Key Visual gate.** The Creative Director proposes a Big Idea, a visual direction and a Key Visual prompt. Nothing moves to production until you approve it. The approved Key Visual then becomes the style reference for every piece.
3. **Piece-by-piece gate.** The Editor lists every piece with its copy and visual description. Only the pieces you approve get a prompt or an image.

Agents ask one question at a time and do not assume anything you did not say.

## The agent roles

| Agent | Job |
| --- | --- |
| Orchestrator | Runs the workflow, introduces the team, creates the project folder and hands off to the next agent. |
| DNA Analyst | Checks that the brand has a usable DNA. If not, runs the extraction. |
| Scout | Researches trends and market news for the market where the content goes live. |
| Planner | Turns the brief into a 7-day grid or a campaign plan. |
| Creative Director | Writes the Big Idea and the Key Visual prompt. |
| Writer | Writes copy, hooks and alt text for each post and carousel slide. |
| Editor | Checks contrast and safe zones, builds one self-contained prompt per piece and generates the approved ones. |
| Social Media Lead | Writer and Editor in one agent, for direct flows. |
| Content Multiplier | After delivery, adapts approved pieces to other formats and channels. |
| Imagens | A photography director. Writes standalone image prompts (scene, light, lens, composition). |

Each agent file starts with a short overview in Portuguese and English, followed by its working rules.

## Languages

The team mirrors the user's language, Portuguese or English, without announcing the switch. Three languages can be in play at once: the conversation, the language the DNA is written in and the language the content is published in. The publishing language comes from the brand DNA. Image prompts are always written in English.

Most agent files are written in Portuguese, with an English overview at the top.

## Running it

**Claude Code.** Open this folder in Claude Code. `CLAUDE.md` loads the whole team. Say "bora começar" or just describe what you need. In this environment the standard post flow ends with ready-to-paste prompts for Nano Banana Pro.

**Gemini or Antigravity.** Use `GEMINI.md` instead. The same flow generates the images and saves them in the project folder.

Each client or brand gets its own folder, created automatically:

```
Projetos/<Client>/DNA.md
Projetos/<Client>/referencias/
Projetos/<Client>/<Campaign>/resultados/
```

### Image generation (Gemini environment)

`ferramentas/gerar-imagens.mjs` generates a batch of approved pieces with Nano Banana Pro (`gemini-3-pro-image-preview`). It passes the approved Key Visual as a reference to keep the set consistent.

```bash
node ferramentas/gerar-imagens.mjs "Projetos/<Client>/<Campaign>/resultados/lote-imagens.json"
```

It needs Node.js and a `GEMINI_API_KEY` environment variable. `ferramentas/geracao-de-imagens.md` documents the batch format and common errors.

Prompts never ask for text inside the image, because image models misspell accents and break kerning. The prompt reserves an empty area, and the Editor delivers the exact copy to place on top.

## Requirements

- Claude Code, or Gemini with Antigravity.
- The [dna](https://github.com/rafaffonso/dna) repository cloned next to this folder as `dna/`. The DNA Analyst uses it to extract a brand DNA, and `ferramentas/importar-dna.mjs` imports the result into this project.
- Node.js, for the tools in `ferramentas/`.
- Optional: a `design` skill in `~/.claude/skills/design`, for deliverables outside the standard post flow (logo, identity kit, slides, icons, banners). It is a separate skill and is not included here.

## What is in the repo

| Path | What it holds |
| --- | --- |
| `CLAUDE.md`, `GEMINI.md` | The master context for each environment. They load the team. |
| `orchestrator.md` and the other agent files | One file per agent. |
| `ferramentas/` | Image batch generator, DNA importer and the image generation guide. |

## Credits

Created with inspiration from the Human Academy course.
