import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(rootDir, "public");

const host = process.env.HOST || "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "8787", 10);
const agentChatUrl = process.env.AGENT_CHAT_URL || "";
const agentChatFormat = process.env.AGENT_CHAT_FORMAT || "simple";
const agentApiKey = process.env.AGENT_API_KEY || "";
const agentModel = process.env.AGENT_MODEL || "";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return sendJson(response, {
        ok: true,
        agentConfigured: Boolean(agentChatUrl),
        agentChatFormat,
        gbrain: {
          mode: process.env.GBRAIN_MCP_MODE || "stdio",
          command: process.env.GBRAIN_MCP_COMMAND || "gbrain serve",
          httpUrl: process.env.GBRAIN_HTTP_URL || "http://127.0.0.1:3131/mcp"
        }
      });
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      const body = await readJsonBody(request);
      const result = await forwardToAgent(body);
      return sendJson(response, result);
    }

    if (request.method !== "GET") {
      return sendJson(response, { error: "Method not allowed" }, 405);
    }

    return serveStatic(url.pathname, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return sendJson(response, { error: message }, 500);
  }
});

server.listen(port, host, () => {
  console.log(`gbrain web UI listening on http://${host}:${port}`);
});

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > 256 * 1024) {
      throw new Error("Request body is too large");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

async function forwardToAgent(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const latest = messages.at(-1)?.content || body.message || "";
  const sessionId = body.sessionId || "default";

  if (!agentChatUrl) {
    return {
      message: setupModeReply(latest),
      meta: {
        mode: "setup",
        agentConfigured: false
      }
    };
  }

  const payload = agentChatFormat === "openai"
    ? {
        model: agentModel || undefined,
        messages,
        stream: false
      }
    : {
        message: latest,
        messages,
        sessionId,
        context: {
          gbrainMcpMode: process.env.GBRAIN_MCP_MODE || "stdio",
          gbrainMcpCommand: process.env.GBRAIN_MCP_COMMAND || "gbrain serve",
          gbrainHttpUrl: process.env.GBRAIN_HTTP_URL || "http://127.0.0.1:3131/mcp"
        }
      };

  const headers = {
    "Content-Type": "application/json"
  };

  if (agentApiKey) {
    headers.Authorization = `Bearer ${agentApiKey}`;
  }

  const upstream = await fetch(agentChatUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000)
  });

  const text = await upstream.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!upstream.ok) {
    return {
      message: "The local agent endpoint returned an error.",
      error: data.error || data.message || upstream.statusText,
      status: upstream.status
    };
  }

  return {
    message: extractAgentMessage(data),
    raw: data
  };
}

function extractAgentMessage(data) {
  if (typeof data === "string") return data;
  if (typeof data.message === "string") return data.message;
  if (typeof data.content === "string") return data.content;
  if (typeof data.response === "string") return data.response;
  if (Array.isArray(data.choices)) {
    return data.choices[0]?.message?.content || data.choices[0]?.text || "";
  }
  return JSON.stringify(data, null, 2);
}

function setupModeReply(latest) {
  const prompt = latest ? `Received: "${latest}"\n\n` : "";
  return `${prompt}No local agent endpoint is configured yet. Set AGENT_CHAT_URL to your OpenClaw or compatible local agent endpoint, then restart the web service. Configure that runtime with GBrain MCP over stdio using command: gbrain serve.`;
}

async function serveStatic(pathname, response) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const normalized = normalize(safePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, normalized);

  if (!filePath.startsWith(publicDir)) {
    return sendJson(response, { error: "Not found" }, 404);
  }

  try {
    const file = await readFile(filePath);
    const type = contentTypes[extname(filePath)] || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store"
    });
    response.end(file);
  } catch {
    sendJson(response, { error: "Not found" }, 404);
  }
}

function sendJson(response, payload, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}
