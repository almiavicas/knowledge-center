#!/usr/bin/env bash
set -euo pipefail

APP_USER="${APP_USER:-gbrain}"
APP_HOME="${APP_HOME:-/opt/gbrain-agent}"
APP_DIR="${APP_DIR:-$APP_HOME/app}"
ENV_DIR="${ENV_DIR:-/etc/gbrain-agent}"
REPO_DIR="${REPO_DIR:-$(pwd)}"

install_systemd_unit() {
  local source="$1"
  local target="$2"

  sed \
    -e "s/^User=gbrain$/User=$APP_USER/" \
    -e "s/^Group=gbrain$/Group=$APP_USER/" \
    -e "s#/opt/gbrain-agent#$APP_HOME#g" \
    "$source" > "$target"
  chmod 0644 "$target"
}

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script with sudo." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This bootstrap targets Ubuntu/Debian EC2 images with apt-get." >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git rsync build-essential sudo

if ! command -v node >/dev/null 2>&1 || ! node --version | grep -Eq '^v24\.'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --create-home --home-dir "$APP_HOME" --shell /bin/bash "$APP_USER"
fi

mkdir -p "$APP_DIR" "$ENV_DIR"
rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude ".env" \
  "$REPO_DIR/" "$APP_DIR/"

chown -R "$APP_USER:$APP_USER" "$APP_HOME"

if [[ ! -f "$ENV_DIR/env" ]]; then
  cp "$APP_DIR/infra/ec2/env.example" "$ENV_DIR/env"
fi
chown root:"$APP_USER" "$ENV_DIR/env"
chmod 0640 "$ENV_DIR/env"

set -a
# shellcheck disable=SC1090
source "$ENV_DIR/env"
set +a

install -m 0755 "$APP_DIR/infra/ec2/run-agent-runtime.sh" /usr/local/bin/gbrain-agent-runtime
install_systemd_unit "$APP_DIR/infra/ec2/systemd/gbrain-web.service" /etc/systemd/system/gbrain-web.service
install_systemd_unit "$APP_DIR/infra/ec2/systemd/gbrain-agent-runtime.service" /etc/systemd/system/gbrain-agent-runtime.service
install_systemd_unit "$APP_DIR/infra/ec2/systemd/gbrain-http.service" /etc/systemd/system/gbrain-http.service

sudo -H -u "$APP_USER" bash -lc 'curl -fsSL https://bun.sh/install | bash'
sudo -H -u "$APP_USER" bash -lc 'export PATH="$HOME/.bun/bin:$PATH"; bun install -g github:garrytan/gbrain'

if [[ "${GBRAIN_SKIP_INIT:-0}" != "1" ]]; then
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    echo "OPENAI_API_KEY is empty; skipping gbrain init. Set it in $ENV_DIR/env, then run gbrain init as $APP_USER." >&2
  else
    sudo -H -u "$APP_USER" env \
      OPENAI_API_KEY="$OPENAI_API_KEY" \
      GBRAIN_EMBEDDING_MODEL="${GBRAIN_EMBEDDING_MODEL:-openai:text-embedding-3-small}" \
      GBRAIN_EMBEDDING_DIMENSIONS="${GBRAIN_EMBEDDING_DIMENSIONS:-1536}" \
      bash -lc 'export PATH="$HOME/.bun/bin:$PATH"; if [[ ! -f "$HOME/.gbrain/config.json" ]]; then gbrain init --pglite --embedding-model "$GBRAIN_EMBEDDING_MODEL" --embedding-dimensions "$GBRAIN_EMBEDDING_DIMENSIONS"; fi'
  fi
fi

sudo -H -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm install --omit=dev"

systemctl daemon-reload
systemctl enable gbrain-web
systemctl enable gbrain-agent-runtime
systemctl restart gbrain-web
systemctl restart gbrain-agent-runtime

cat <<EOF

Bootstrap complete.

Edit runtime settings:
  sudo nano $ENV_DIR/env

Restart services:
  sudo systemctl restart gbrain-agent-runtime gbrain-web

Open an SSH tunnel from your laptop:
  ssh -L 8787:127.0.0.1:8787 ubuntu@YOUR_EC2_HOST

Then open:
  http://127.0.0.1:8787

Optional GBrain HTTP MCP:
  sudo systemctl enable --now gbrain-http
EOF
