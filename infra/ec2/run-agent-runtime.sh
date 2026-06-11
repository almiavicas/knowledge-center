#!/usr/bin/env bash
set -euo pipefail

if [[ -f /etc/gbrain-agent/env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /etc/gbrain-agent/env
  set +a
fi

export PATH="$HOME/.bun/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

if [[ -z "${AGENT_RUNTIME_CMD:-}" ]]; then
  echo "AGENT_RUNTIME_CMD is empty. Configure /etc/gbrain-agent/env to start OpenClaw or another compatible local agent runtime."
  exec sleep infinity
fi

exec bash -lc "$AGENT_RUNTIME_CMD"
