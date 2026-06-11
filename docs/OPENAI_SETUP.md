# OpenAI Setup

This template's cost-optimized MVP uses OpenAI for two separate jobs:

- chat model for the local agent runtime: `gpt-5.4-mini`
- embeddings for GBrain retrieval: `openai:text-embedding-3-small`

The web UI does not call OpenAI directly. It sends messages to the local agent
runtime through `AGENT_CHAT_URL`. The agent runtime calls OpenAI and uses GBrain
through MCP.

```text
browser -> web UI -> local agent runtime -> OpenAI gpt-5.4-mini
                                      |
                                      -> GBrain MCP -> local PGLite vectors
```

## 1. Create An OpenAI API Key

Create a project-scoped API key in the OpenAI dashboard and store it only on the
EC2 instance. Do not put the key in frontend code, committed files, screenshots, or
sample configs.

Recommended account controls:

- set a monthly project budget around `$20`
- set an email alert below the hard budget, for example `$10`
- monitor usage during the first week

API usage is billed separately from ChatGPT subscriptions.

## 2. Configure The EC2 Environment

On the EC2 instance:

```bash
sudo nano /etc/gbrain-agent/env
```

Set these values:

```bash
OPENAI_API_KEY=sk-proj-...
OPENAI_CHAT_MODEL=gpt-5.4-mini
AGENT_MODEL=gpt-5.4-mini

GBRAIN_EMBEDDING_MODEL=openai:text-embedding-3-small
GBRAIN_EMBEDDING_DIMENSIONS=1536
```

If your OpenAI project does not have access to `gpt-5.4-mini`, replace both
`OPENAI_CHAT_MODEL` and `AGENT_MODEL` with the closest available low-cost chat
model. Keep the embedding settings unchanged unless GBrain reports a dimension
mismatch.

Keep the web UI private:

```bash
HOST=127.0.0.1
PORT=8787
```

Then restart the local services:

```bash
sudo systemctl restart gbrain-agent-runtime
sudo systemctl restart gbrain-web
```

## 3. Initialize GBrain With OpenAI Embeddings

If `OPENAI_API_KEY` is set in `/etc/gbrain-agent/env` before bootstrap reaches the
GBrain step, bootstrap initializes GBrain with:

```bash
gbrain init --pglite \
  --embedding-model openai:text-embedding-3-small \
  --embedding-dimensions 1536
```

If you add the key after bootstrap, initialize GBrain manually as the service user:

```bash
sudo -H -u gbrain bash -lc ' \
  export PATH="$HOME/.bun/bin:$PATH"; \
  set -a; \
  source /etc/gbrain-agent/env; \
  set +a; \
  gbrain init --pglite \
    --embedding-model "$GBRAIN_EMBEDDING_MODEL" \
    --embedding-dimensions "$GBRAIN_EMBEDDING_DIMENSIONS" \
  '
```

Verify:

```bash
sudo -H -u gbrain bash -lc ' \
  export PATH="$HOME/.bun/bin:$PATH"; \
  set -a; \
  source /etc/gbrain-agent/env; \
  set +a; \
  gbrain doctor \
'
```

## 4. Configure The Agent Runtime

OpenClaw or another local runtime should use:

- OpenAI provider key: `OPENAI_API_KEY`
- default chat model: `gpt-5.4-mini`
- GBrain MCP server: `gbrain serve`

MCP config shape:

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

The exact OpenClaw command can vary by install method. Set it in:

```bash
AGENT_RUNTIME_CMD=
```

The runtime should expose the local chat endpoint configured by:

```bash
AGENT_CHAT_URL=http://127.0.0.1:3020/chat
```

## 5. Cost Controls

For the first version, keep the system on demand:

- do not enable GBrain dream cycle or cron enrichment yet
- prefer `gbrain search` for raw retrieval when synthesis is not needed
- use `gbrain think` only when you want a written answer with citations
- import receipts in batches instead of constantly syncing a large folder
- keep web search, browser tools, and autonomous shell tools disabled until needed

The expensive part is usually not receipt embeddings. It is long agent chat turns
with tool calls, memory context, and synthesized answers.

## Sources

- OpenAI API pricing: https://openai.com/api/pricing/
- GBrain install docs: https://github.com/garrytan/gbrain/blob/master/docs/INSTALL.md
- GBrain embedding providers: https://github.com/garrytan/gbrain/blob/master/docs/integrations/embedding-providers.md
