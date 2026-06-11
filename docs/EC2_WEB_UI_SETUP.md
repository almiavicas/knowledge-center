# EC2 Web UI Setup

This guide walks a new user through launching one Ubuntu EC2 instance, installing
this repository on it, and opening the private web UI from a local browser through
an SSH tunnel.

The web UI is intentionally not exposed to the public internet. The instance only
needs inbound SSH from your current IP address. Your browser connects to
`http://127.0.0.1:8787` on your laptop, and SSH forwards that traffic to the web
service running on the EC2 instance.

```text
local browser
  |
  | http://127.0.0.1:8787
  v
local SSH tunnel
  |
  | ssh -L 8787:127.0.0.1:8787
  v
EC2 instance web UI bound to 127.0.0.1:8787
```

## Prerequisites

- An AWS account with permission to create EC2 instances, key pairs, and security
  groups.
- A local terminal with `ssh`.
- The Git clone URL for this repository.
- Optional for the first boot: an OpenAI API key. If you do not set it before
  bootstrap, GBrain initialization is skipped and you can initialize it later.

## 1. Launch The EC2 Instance

In the AWS console, open EC2 and choose **Launch instance**.

Recommended first-instance settings:

- Name: `gbrain-agent`
- AMI: Ubuntu Server 24.04 LTS or Ubuntu Server 22.04 LTS
- Architecture: 64-bit x86
- Instance type: `t3.small` for a light test, or `t3.medium` if you expect more
  agent/runtime work
- Key pair: create or select an `.pem` key pair you can access locally
- Network: default VPC is fine for a first private MVP
- Subnet: public subnet
- Auto-assign public IP: enabled
- Storage: at least 20 GB gp3

Create a security group with this inbound rule only:

| Type | Protocol | Port | Source |
| --- | --- | ---: | --- |
| SSH | TCP | 22 | Your current public IPv4 address as `/32` |

Do not add inbound HTTP, HTTPS, or `8787` rules for this private setup. The web UI
is reached through the SSH tunnel.

Leave the default outbound rule that allows the instance to reach the internet.
Bootstrap needs outbound access to install packages, Node, Bun, npm dependencies,
and GBrain.

Launch the instance and wait until EC2 shows both status checks passing.

## 2. Connect With SSH

On your laptop, protect the key file:

```bash
chmod 400 /path/to/your-key.pem
```

Connect to the instance. Use the public IPv4 address or public DNS name shown in
the EC2 console:

```bash
ssh -i /path/to/your-key.pem ubuntu@YOUR_EC2_PUBLIC_DNS_OR_IP
```

For Ubuntu AMIs, the default user is usually `ubuntu`.

If SSH times out, check that:

- The instance is running and status checks passed.
- The instance has a public IPv4 address.
- The security group allows TCP `22` from your current public IP.
- Your local network allows outbound SSH.

If SSH says `Permission denied`, check that:

- You are using the key pair selected at launch.
- The key file has restrictive permissions, such as `chmod 400`.
- You are using `ubuntu@...`, not `ec2-user@...`.

## 3. Clone The Repository

Install Git if the AMI does not already include it:

```bash
sudo apt-get update
sudo apt-get install -y git
```

Clone the repository and enter it:

```bash
git clone REPLACE_WITH_THIS_REPOSITORY_URL gbrain-ec2-agent-template
cd gbrain-ec2-agent-template
```

For a private GitHub repository, use your normal GitHub SSH key or a temporary
HTTPS token. Do not commit secrets into this repository.

## 4. Bootstrap The Instance

Run the bootstrap script from the repository root:

```bash
sudo ./infra/ec2/bootstrap.sh
```

The bootstrap script:

- Installs system packages required by the app.
- Installs Node 24.
- Creates the `gbrain` service user.
- Copies the repository to `/opt/gbrain-agent/app`.
- Creates `/etc/gbrain-agent/env` from `infra/ec2/env.example` if it does not
  already exist.
- Installs Bun and GBrain for the `gbrain` user.
- Installs production npm dependencies.
- Installs and starts systemd services for the web UI and local agent runtime.

The web service starts even if no agent runtime is configured yet. In that state,
the UI responds in setup/diagnostic mode.

## 5. Configure The Environment

Open the instance environment file:

```bash
sudo nano /etc/gbrain-agent/env
```

Keep these values for private tunneled access:

```bash
HOST=127.0.0.1
PORT=8787
```

For the first pass, it is fine to leave the agent runtime empty:

```bash
AGENT_RUNTIME_CMD=
```

When `AGENT_RUNTIME_CMD` is empty, the `gbrain-agent-runtime` service intentionally
prints a setup message and sleeps. Configure OpenClaw or another compatible
runtime later by setting `AGENT_RUNTIME_CMD` to the command that starts the runtime
and exposes `AGENT_CHAT_URL`, which defaults to:

```bash
AGENT_CHAT_URL=http://127.0.0.1:3020/chat
```

If you want GBrain and your future runtime to use OpenAI, set:

```bash
OPENAI_API_KEY=sk-proj-...
OPENAI_CHAT_MODEL=gpt-5.4-mini
AGENT_MODEL=gpt-5.4-mini
GBRAIN_EMBEDDING_MODEL=openai:text-embedding-3-small
GBRAIN_EMBEDDING_DIMENSIONS=1536
```

See [OPENAI_SETUP.md](OPENAI_SETUP.md) for the full OpenAI and GBrain setup.

Restart the services after changing the environment file:

```bash
sudo systemctl restart gbrain-agent-runtime gbrain-web
```

Check service status:

```bash
sudo systemctl status gbrain-web --no-pager
sudo systemctl status gbrain-agent-runtime --no-pager
```

View logs if needed:

```bash
sudo journalctl -u gbrain-web -n 100 --no-pager
sudo journalctl -u gbrain-agent-runtime -n 100 --no-pager
```

## 6. Open The Web UI Through An SSH Tunnel

Keep the EC2 SSH session available, or open a new terminal on your laptop and run:

```bash
ssh -i /path/to/your-key.pem -L 8787:127.0.0.1:8787 ubuntu@YOUR_EC2_PUBLIC_DNS_OR_IP
```

Leave that SSH session running. Then open this URL in your local browser:

```text
http://127.0.0.1:8787
```

This opens the web UI running on the EC2 instance, but the browser only talks to
your laptop's local `127.0.0.1` address.

You can also check the health endpoint:

```text
http://127.0.0.1:8787/api/health
```

## 7. What OpenClaw Does Here

This repository has three separate layers:

- `apps/web`: the private browser UI and HTTP proxy.
- OpenClaw or another compatible runtime: the local agent process that receives
  chat requests, calls the model provider, invokes tools, and talks to GBrain.
- GBrain: the local memory/vector store exposed to the runtime through MCP.

The web UI does not call OpenAI or GBrain directly. It forwards chat messages to
`AGENT_CHAT_URL`. OpenClaw is the process that would normally listen behind that
URL and own the actual agent loop.

It usually makes sense to bring this stack up in two phases:

1. First, launch EC2, run bootstrap, verify `gbrain-web`, and confirm the SSH
   tunnel opens the setup-mode UI.
2. Then install/configure OpenClaw and set `AGENT_RUNTIME_CMD` once the private
   web UI and instance services are known to work.

Use OpenClaw from the start only if you already know the exact install command,
provider configuration, MCP configuration, and local HTTP chat endpoint you want
it to expose. Otherwise, deferring it reduces setup variables: you can debug EC2,
systemd, and tunneling separately from agent-runtime behavior.

When OpenClaw is added, it should:

- Run only on the EC2 host, not in browser code.
- Bind its HTTP chat endpoint to `127.0.0.1`.
- Use the OpenAI key from `/etc/gbrain-agent/env` or its own root-readable/service
  configuration, not from committed files.
- Connect to GBrain with MCP stdio using `gbrain serve`, unless you intentionally
  enable the optional HTTP MCP service.

The exact OpenClaw command is intentionally left out of the bootstrap because it
can vary by OpenClaw install method and plugin/runtime choices.

## 8. Common Troubleshooting

### Local port 8787 is already in use

Use another local port while still forwarding to remote port `8787`:

```bash
ssh -i /path/to/your-key.pem -L 9876:127.0.0.1:8787 ubuntu@YOUR_EC2_PUBLIC_DNS_OR_IP
```

Then open:

```text
http://127.0.0.1:9876
```

### Browser cannot load the UI

On the instance, confirm the web service is running:

```bash
sudo systemctl status gbrain-web --no-pager
sudo journalctl -u gbrain-web -n 100 --no-pager
```

Confirm the service is listening on loopback:

```bash
ss -ltn | grep 8787
```

Expected shape:

```text
LISTEN ... 127.0.0.1:8787 ...
```

If the service is not listening, restart it:

```bash
sudo systemctl restart gbrain-web
```

### The UI says the agent is not configured

That is expected until you configure `AGENT_RUNTIME_CMD` in
`/etc/gbrain-agent/env`. The web UI can be used to verify the private tunnel first;
the agent runtime can be connected later.

### Bootstrap skipped GBrain initialization

If `OPENAI_API_KEY` was empty during bootstrap, the script skips `gbrain init`.
After adding the key to `/etc/gbrain-agent/env`, follow the manual initialization
steps in [OPENAI_SETUP.md](OPENAI_SETUP.md).

### Bootstrap failed with `serve: command not found`

This means `/etc/gbrain-agent/env` has an old unquoted command value:

```bash
GBRAIN_MCP_COMMAND=gbrain serve
```

Edit the file:

```bash
sudo nano /etc/gbrain-agent/env
```

Change the line to:

```bash
GBRAIN_MCP_COMMAND="gbrain serve"
```

Then rerun bootstrap from the repository root:

```bash
sudo ./infra/ec2/bootstrap.sh
```

### Bootstrap failed with `unzip is required to install bun`

Install the missing package, then rerun bootstrap from the repository root:

```bash
sudo apt-get update
sudo apt-get install -y unzip
sudo ./infra/ec2/bootstrap.sh
```

### You changed the security group but SSH still fails

Your public IP may have changed. Update the security group SSH rule so the source
is your current public IPv4 address with `/32`.

## Reference

- AWS EC2 SSH documentation:
  <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-linux-inst-ssh.html>
- AWS EC2 security group rule examples:
  <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html>
- OpenClaw agent runtime concepts:
  <https://docs.openclaw.ai/concepts/agent-runtimes>
