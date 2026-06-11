# Architecture

This template runs a private agent workspace on one EC2 instance.

```text
browser
  |
  | SSH tunnel to 127.0.0.1:8787
  v
web UI / local proxy
  |
  | AGENT_CHAT_URL
  v
OpenClaw or compatible runtime
  |
  | MCP stdio: gbrain serve
  v
GBrain local PGLite memory
```

## Components

### Web UI

The web UI is a private chat frontend and local HTTP proxy. It does not talk to
GBrain directly. It forwards messages to the local agent runtime and passes GBrain
connection hints in the request context.

### Agent Runtime

The template expects OpenClaw or another compatible runtime to be started
by `AGENT_RUNTIME_CMD`. That runtime owns model selection, tool invocation, and MCP
client configuration.

The runtime should be configured with a GBrain MCP server:

```json
{
  "command": "gbrain",
  "args": ["serve"]
}
```

### GBrain

GBrain is initialized locally with PGLite. This keeps the MVP self-contained and
avoids an external Supabase/Postgres dependency.

The recommended path for the single-host MVP is MCP stdio. GBrain HTTP MCP is
available as an optional systemd service for clients that need OAuth-backed HTTP.

## Boundaries

- Browser access is private by default through SSH tunneling.
- Services bind to `127.0.0.1` unless you change the environment file.
- The web UI has no database credentials.
- The agent runtime is the only component that should invoke GBrain tools.
