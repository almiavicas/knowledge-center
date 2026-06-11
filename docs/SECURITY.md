# Security Notes

This template is private-first because an always-on agent runtime with memory tools
is a sensitive system.

## Defaults

- Web UI binds to `127.0.0.1`.
- Access uses SSH tunneling.
- GBrain MCP uses local stdio by default.
- GBrain HTTP MCP is installed but not enabled by bootstrap.
- Secrets live in `/etc/gbrain-agent/env` with `0640` permissions, owned by
  `root:gbrain` by default.

## Avoid For MVP

- Do not bind the web UI to `0.0.0.0` without authentication and TLS.
- Do not expose GBrain HTTP MCP publicly without OAuth client setup and scoped
  access.
- Do not give the agent broad shell or cloud credentials until you have a review
  path for tool calls.
- Do not store production secrets in markdown pages.

## Later Hardening

- Add Caddy or nginx with TLS and authentication for public access.
- Move secrets to AWS Secrets Manager or SSM Parameter Store.
- Add structured audit logs for agent requests and MCP tool calls.
- Put the agent runtime in a container or microVM if it gains broad tool access.
- Add EBS snapshots or an explicit backup path for `~/.gbrain`.
