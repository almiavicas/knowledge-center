# GBrain EC2 Agent Template

A small starter repository for running an AI agent appliance on one EC2 instance with
GBrain as the local memory and vector database.

The MVP shape is intentionally narrow:

- one EC2 host
- local GBrain/PGLite memory
- OpenClaw or another compatible agent runtime running on the host
- OpenAI configured as the default model provider with `gpt-5.4-mini`
- a private web chat UI bound to `127.0.0.1`
- food expense records stored as markdown and indexed by GBrain

No Telegram, no external Supabase, and no public HTTPS are included in this first
version.

## Quick Start Locally

```bash
nvm use
npm install
npm run dev
```

Open `http://127.0.0.1:8787`.

Without an agent runtime configured, the UI stays in setup mode and returns a local
diagnostic response. Point it at your runtime by setting:

```bash
cp .env.example .env
AGENT_CHAT_URL=http://127.0.0.1:3020/chat npm run dev
```

The web service supports two response styles:

- `AGENT_CHAT_FORMAT=simple`: sends `{ message, messages, sessionId, context }`
- `AGENT_CHAT_FORMAT=openai`: sends OpenAI-compatible `{ model, messages, stream }`

## EC2 MVP

For a complete first-time walkthrough, see
[docs/EC2_WEB_UI_SETUP.md](docs/EC2_WEB_UI_SETUP.md).

Provision an Ubuntu EC2 instance, clone this repo, then run:

```bash
sudo ./infra/ec2/bootstrap.sh
```

The bootstrap installs Node 24, Bun, GBrain, systemd units, and the web UI. It
initializes GBrain with local PGLite unless `GBRAIN_SKIP_INIT=1` is set.

After bootstrap, edit:

```bash
sudo nano /etc/gbrain-agent/env
```

Set `AGENT_RUNTIME_CMD` to the command that starts your OpenClaw or compatible
local agent runtime.
The runtime should expose a local HTTP chat endpoint matching `AGENT_CHAT_URL`.

For the recommended OpenAI setup, set:

```bash
OPENAI_API_KEY=sk-proj-...
OPENAI_CHAT_MODEL=gpt-5.4-mini
AGENT_MODEL=gpt-5.4-mini
GBRAIN_EMBEDDING_MODEL=openai:text-embedding-3-small
GBRAIN_EMBEDDING_DIMENSIONS=1536
```

See [docs/OPENAI_SETUP.md](docs/OPENAI_SETUP.md) for the full setup and cost
controls.

If bootstrap runs before `OPENAI_API_KEY` is set, it skips GBrain initialization.
After adding the key, follow the manual initialization step in
[docs/OPENAI_SETUP.md](docs/OPENAI_SETUP.md).

Start services:

```bash
sudo systemctl restart gbrain-agent-runtime
sudo systemctl restart gbrain-web
```

Access the UI through an SSH tunnel:

```bash
ssh -L 8787:127.0.0.1:8787 ubuntu@YOUR_EC2_HOST
```

Then open `http://127.0.0.1:8787` on your laptop.

## GBrain Memory

GBrain is installed from `github:garrytan/gbrain` and initialized with PGLite:

```bash
bun install -g github:garrytan/gbrain
gbrain init --pglite
gbrain doctor
```

For local agents, configure the agent runtime to use GBrain over MCP stdio:

```json
{
  "mcpServers": {
    "gbrain": {
      "command": "gbrain",
      "args": ["serve"]
    }
  }
}
```

HTTP MCP is also available through GBrain with `gbrain serve --http`, but this
template keeps it optional because the local stdio path is simpler and safer for a
single-host MVP.

## Expense Pilot

Food expenses are markdown pages under `examples/expenses`. A production agent can
write similar pages into your chosen brain/source directory, then call:

```bash
gbrain import /path/to/expenses
```

The recommended invoice page shape is:

```markdown
---
type: food_invoice
date: 2026-06-08
merchant: Green Market
currency: USD
total: 42.18
---

# Green Market - 2026-06-08

## Items

| Product | Quantity | Unit price | Total |
| --- | ---: | ---: | ---: |
| Eggs | 1 carton | 6.49 | 6.49 |
```

The UI includes starter prompts for asking the agent to capture or query expense
data through GBrain.

## Repository Layout

```text
apps/web/              private chat UI and local agent proxy
examples/expenses/     sample markdown expense records
infra/ec2/             bootstrap script, env template, systemd units
scripts/               local helpers for expense markdown and GBrain checks
docs/                  architecture, expense model, and security notes
```

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE).

## Sources

This template follows GBrain's documented local install and MCP patterns:

- https://github.com/garrytan/gbrain
- https://github.com/garrytan/gbrain/blob/master/docs/INSTALL.md
- https://github.com/garrytan/gbrain/blob/master/docs/integrations/embedding-providers.md
- https://github.com/garrytan/gbrain/blob/master/docs/mcp/DEPLOY.md
