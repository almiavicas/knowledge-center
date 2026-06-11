const messagesEl = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const clearButton = document.querySelector("#clearButton");
const agentDot = document.querySelector("#agentDot");
const agentStatus = document.querySelector("#agentStatus");
const promptButtons = document.querySelectorAll("[data-prompt]");

const sessionId = crypto.randomUUID();
const messages = [];

init();

async function init() {
  await refreshHealth();
  addMessage("system", "Private EC2 console. GBrain memory is expected through the local agent runtime.");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = input.value.trim();
  if (!content) return;

  input.value = "";
  await sendUserMessage(content);
});

clearButton.addEventListener("click", () => {
  messages.length = 0;
  messagesEl.innerHTML = "";
  addMessage("system", "Session cleared.");
});

promptButtons.forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt;
    input.focus();
  });
});

async function refreshHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    if (data.agentConfigured) {
      agentDot.classList.add("ready");
      agentStatus.textContent = "Agent linked";
    } else {
      agentDot.classList.remove("ready");
      agentStatus.textContent = "Setup mode";
    }
  } catch {
    agentDot.classList.remove("ready");
    agentStatus.textContent = "Unavailable";
  }
}

async function sendUserMessage(content) {
  const userMessage = { role: "user", content };
  messages.push(userMessage);
  addMessage("user", content);

  const pending = addMessage("assistant", "Working...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId,
        message: content,
        messages
      })
    });

    const data = await response.json();
    const assistantText = data.message || data.error || "No response.";
    pending.textContent = assistantText;
    messages.push({ role: "assistant", content: assistantText });
  } catch (error) {
    pending.textContent = error instanceof Error ? error.message : "Request failed.";
  }
}

function addMessage(role, content) {
  const node = document.createElement("article");
  node.className = `message ${role}`;
  node.textContent = content;
  messagesEl.append(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return node;
}
