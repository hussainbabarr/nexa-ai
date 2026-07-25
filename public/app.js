const STORAGE_KEY = "nexa-ai-web-conversations-v1";
const THEME_KEY = "nexa-ai-theme";

const state = {
  conversations: [],
  activeId: null,
  controller: null,
  loading: false,
};

const elements = {
  sidebar: document.querySelector("#sidebar"),
  sidebarBackdrop: document.querySelector("#sidebar-backdrop"),
  openSidebar: document.querySelector("#open-sidebar"),
  closeSidebar: document.querySelector("#close-sidebar"),
  historyList: document.querySelector("#history-list"),
  clearHistory: document.querySelector("#clear-history"),
  newChat: document.querySelector("#new-chat"),
  headerNewChat: document.querySelector("#header-new-chat"),
  conversationTitle: document.querySelector("#conversation-title"),
  conversation: document.querySelector("#conversation"),
  welcome: document.querySelector("#welcome"),
  messages: document.querySelector("#messages"),
  composer: document.querySelector("#composer"),
  input: document.querySelector("#message-input"),
  sendButton: document.querySelector("#send-button"),
  themeToggle: document.querySelector("#theme-toggle"),
  statusButton: document.querySelector("#status-button"),
  statusDot: document.querySelector("#status-dot"),
  statusText: document.querySelector("#status-text"),
  creatorLink: document.querySelector("#creator-link"),
  toast: document.querySelector("#toast"),
};

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderMarkdown(source) {
  const codeBlocks = [];
  const protectedSource = source.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, code) => {
    const index = codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`) - 1;
    return `\n@@CODEBLOCK_${index}@@\n`;
  });

  const lines = protectedSource.split(/\r?\n/);
  const output = [];
  let listType = null;

  const closeList = () => {
    if (listType) {
      output.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const codeMatch = trimmed.match(/^@@CODEBLOCK_(\d+)@@$/);
    if (codeMatch) {
      closeList();
      output.push(codeBlocks[Number(codeMatch[1])] ?? "");
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)/);
    if (unordered || ordered) {
      const nextType = unordered ? "ul" : "ol";
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        output.push(`<${listType}>`);
      }
      output.push(`<li>${renderInline((unordered || ordered)[1])}</li>`);
      continue;
    }

    closeList();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith("### ")) {
      output.push(`<h3>${renderInline(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("## ")) {
      output.push(`<h2>${renderInline(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("# ")) {
      output.push(`<h1>${renderInline(trimmed.slice(2))}</h1>`);
    } else {
      output.push(`<p>${renderInline(trimmed)}</p>`);
    }
  }

  closeList();
  return output.join("");
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    state.conversations = Array.isArray(parsed) ? parsed : [];
    state.activeId = state.conversations[0]?.id ?? null;
  } catch {
    state.conversations = [];
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.conversations));
}

function activeConversation() {
  return state.conversations.find((item) => item.id === state.activeId) ?? null;
}

function makeTitle(text) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 42 ? `${compact.slice(0, 42)}…` : compact;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => elements.toast.classList.remove("show"), 1800);
}

function closeSidebar() {
  elements.sidebar.classList.remove("open");
  elements.sidebarBackdrop.classList.remove("open");
}

function startNewChat() {
  state.controller?.abort();
  state.activeId = null;
  state.loading = false;
  elements.input.value = "";
  autoSizeInput();
  closeSidebar();
  render();
  elements.input.focus();
}

function deleteConversation(id) {
  state.conversations = state.conversations.filter((item) => item.id !== id);
  if (state.activeId === id) {
    state.activeId = state.conversations[0]?.id ?? null;
  }
  saveState();
  render();
}

function renderHistory() {
  elements.historyList.replaceChildren();
  if (!state.conversations.length) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = "Your conversations will appear here and stay saved in this browser.";
    elements.historyList.append(empty);
    return;
  }

  for (const conversation of state.conversations) {
    const item = document.createElement("button");
    item.className = `history-item${conversation.id === state.activeId ? " active" : ""}`;
    item.type = "button";
    item.innerHTML = `<span class="chat-mark">◇</span><span class="history-title">${escapeHtml(conversation.title)}</span>`;
    item.addEventListener("click", () => {
      state.activeId = conversation.id;
      closeSidebar();
      render();
    });

    const remove = document.createElement("button");
    remove.className = "history-delete";
    remove.type = "button";
    remove.setAttribute("aria-label", `Delete ${conversation.title}`);
    remove.textContent = "×";
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteConversation(conversation.id);
    });
    item.append(remove);
    elements.historyList.append(item);
  }
}

function messageElement(message) {
  const wrapper = document.createElement("article");
  wrapper.className = `message ${message.role}${message.isError ? " message-error" : ""}`;

  if (message.role === "user") {
    const bubble = document.createElement("div");
    bubble.className = "user-bubble";
    bubble.textContent = message.content;
    wrapper.append(bubble);
    return wrapper;
  }

  const avatar = document.createElement("div");
  avatar.className = "assistant-avatar";
  avatar.textContent = "N";
  const body = document.createElement("div");
  body.className = "assistant-body";

  if (message.pending) {
    body.innerHTML = '<div class="thinking" aria-label="Nexa AI is thinking"><span></span><span></span><span></span></div>';
  } else {
    const content = document.createElement("div");
    content.innerHTML = renderMarkdown(message.content);
    body.append(content);

    if (!message.isError) {
      const actions = document.createElement("div");
      actions.className = "message-actions";
      const copy = document.createElement("button");
      copy.className = "message-action";
      copy.type = "button";
      copy.textContent = "Copy answer";
      copy.addEventListener("click", async () => {
        await navigator.clipboard.writeText(message.content);
        showToast("Answer copied");
      });
      actions.append(copy);
      body.append(actions);
    }
  }

  wrapper.append(avatar, body);
  return wrapper;
}

function renderMessages() {
  const conversation = activeConversation();
  elements.messages.replaceChildren();
  elements.welcome.hidden = Boolean(conversation);
  elements.messages.classList.toggle("active", Boolean(conversation));
  elements.conversationTitle.textContent = conversation?.title ?? "New conversation";

  if (!conversation) {
    return;
  }

  for (const message of conversation.messages) {
    elements.messages.append(messageElement(message));
  }

  requestAnimationFrame(() => {
    elements.conversation.scrollTop = elements.conversation.scrollHeight;
  });
}

function render() {
  renderHistory();
  renderMessages();
  elements.sendButton.classList.toggle("loading", state.loading);
  elements.sendButton.disabled = !state.loading && !elements.input.value.trim();
}

function autoSizeInput() {
  elements.input.style.height = "auto";
  elements.input.style.height = `${Math.min(elements.input.scrollHeight, 180)}px`;
  elements.sendButton.disabled = !state.loading && !elements.input.value.trim();
}

async function sendMessage(text) {
  const content = text.trim();
  if (!content || state.loading) {
    return;
  }

  let conversation = activeConversation();
  const userMessage = {
    id: makeId("user"),
    role: "user",
    content,
    createdAt: Date.now(),
  };

  if (!conversation) {
    conversation = {
      id: makeId("chat"),
      title: makeTitle(content),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.conversations.unshift(conversation);
    state.activeId = conversation.id;
  }

  conversation.messages.push(userMessage);
  conversation.updatedAt = Date.now();
  state.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  elements.input.value = "";
  autoSizeInput();
  state.loading = true;

  const pending = {
    id: makeId("pending"),
    role: "assistant",
    content: "",
    pending: true,
    createdAt: Date.now(),
  };
  conversation.messages.push(pending);
  saveState();
  render();

  const controller = new AbortController();
  state.controller = controller;
  const timer = window.setTimeout(() => controller.abort(), 55000);

  try {
    const requestMessages = conversation.messages
      .filter((message) => !message.pending && !message.isError)
      .map(({ role, content: messageContent }) => ({ role, content: messageContent }));

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: requestMessages }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || typeof body.text !== "string") {
      throw new Error(body.error || `Request failed (${response.status})`);
    }

    Object.assign(pending, {
      content: body.text,
      pending: false,
      model: body.model,
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    Object.assign(pending, {
      content: aborted
        ? "The request was stopped. Please send your message again when ready."
        : `**Request failed**\n\n${error instanceof Error ? error.message : "Please try again."}`,
      pending: false,
      isError: true,
    });
  } finally {
    window.clearTimeout(timer);
    state.loading = false;
    state.controller = null;
    conversation.updatedAt = Date.now();
    saveState();
    render();
  }
}

async function checkHealth() {
  elements.statusDot.className = "status-dot";
  elements.statusText.textContent = "Checking AI service";
  try {
    const response = await fetch("/health", { cache: "no-store" });
    const health = await response.json();
    if (!response.ok || health.ok !== true) {
      throw new Error("Health check failed");
    }
    if (!health.configured) {
      elements.statusDot.classList.add("error");
      elements.statusText.textContent = "Groq key not configured";
      return;
    }
    elements.statusDot.classList.add("online");
    elements.statusText.textContent = "AI service online";
  } catch {
    elements.statusDot.classList.add("error");
    elements.statusText.textContent = "AI service unavailable";
  }
}

async function loadPublicConfig() {
  try {
    const response = await fetch("/app-config", { cache: "no-store" });
    const config = await response.json();
    if (
      response.ok &&
      typeof config.whatsappUrl === "string" &&
      config.whatsappUrl.startsWith("https://wa.me/")
    ) {
      elements.creatorLink.href = config.whatsappUrl;
      return;
    }
  } catch {
    // The creator label remains visible when no public contact is configured.
  }

  elements.creatorLink.removeAttribute("href");
  elements.creatorLink.removeAttribute("target");
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

elements.composer.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.loading) {
    state.controller?.abort();
  } else {
    sendMessage(elements.input.value);
  }
});

elements.input.addEventListener("input", autoSizeInput);
elements.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    elements.composer.requestSubmit();
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    startNewChat();
  }
});

document.querySelectorAll(".suggestion-card").forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt || ""));
});

elements.newChat.addEventListener("click", startNewChat);
elements.headerNewChat.addEventListener("click", startNewChat);
elements.openSidebar.addEventListener("click", () => {
  elements.sidebar.classList.add("open");
  elements.sidebarBackdrop.classList.add("open");
});
elements.closeSidebar.addEventListener("click", closeSidebar);
elements.sidebarBackdrop.addEventListener("click", closeSidebar);
elements.clearHistory.addEventListener("click", () => {
  state.conversations = [];
  state.activeId = null;
  saveState();
  render();
  showToast("Chat history cleared");
});
elements.themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  applyTheme(next);
});
elements.statusButton.addEventListener("click", checkHealth);

const preferredTheme =
  localStorage.getItem(THEME_KEY) ||
  (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
applyTheme(preferredTheme);
loadState();
render();
autoSizeInput();
checkHealth();
loadPublicConfig();
