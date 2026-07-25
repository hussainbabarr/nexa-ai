import { type ChatMessage } from "./types";

interface ChatResponse {
  text: string;
  responseId: string;
  model: string;
}

interface HealthResponse {
  ok: boolean;
  configured: boolean;
  chatConfigured: boolean;
  chatProvider: string;
  model: string;
  imageConfigured: boolean;
  imageModel: string;
  service: string;
}

interface ImageResponse {
  imageUrl: string;
  prompt: string;
  model: string;
  size: string;
  quality: string;
}

const CHAT_TIMEOUT_MS = 45_000;
const IMAGE_TIMEOUT_MS = 120_000;
const HEALTH_TIMEOUT_MS = 8_000;

function endpoint(baseUrl: string, path: string) {
  return `${baseUrl.trim().replace(/\/+$/, "")}${path}`;
}

async function fetchWithTimeout(
  baseUrl: string,
  path: string,
  init: RequestInit,
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(endpoint(baseUrl, path), {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new Error(
        "The Nexa AI server did not respond in time. Check your internet connection and the server URL in Settings, then try again.",
      );
    }

    if (externalSignal?.aborted) {
      const abortedError = new Error("Request aborted");
      abortedError.name = "AbortError";
      throw abortedError;
    }

    const normalizedUrl = baseUrl.trim().replace(/\/+$/, "");
    throw new Error(
      `Cannot connect to the Nexa AI server at ${normalizedUrl}. Check your internet connection and confirm the server URL in Settings.`,
    );
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return { error: text || `HTTP ${response.status}` };
  }
}

export async function requestChat(
  baseUrl: string,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ChatResponse> {
  const response = await fetchWithTimeout(
    baseUrl,
    "/api/chat",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages.map(({ id, role, content }) => ({
          id,
          role,
          content,
        })),
      }),
    },
    signal,
    CHAT_TIMEOUT_MS,
  );

  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : `Request failed with status ${response.status}.`,
    );
  }

  if (typeof body.text !== "string") {
    throw new Error("The server returned an invalid response.");
  }

  return body as unknown as ChatResponse;
}

export async function requestImage(
  baseUrl: string,
  prompt: string,
  signal: AbortSignal,
): Promise<ImageResponse> {
  const response = await fetchWithTimeout(
    baseUrl,
    "/api/image",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        size: "1024x1024",
        quality: "medium",
      }),
    },
    signal,
    IMAGE_TIMEOUT_MS,
  );
  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : `Image request failed with status ${response.status}.`,
    );
  }

  if (typeof body.imagePath !== "string") {
    throw new Error("The server returned an invalid image response.");
  }

  return {
    imageUrl: body.imagePath.startsWith("http")
      ? body.imagePath
      : endpoint(baseUrl, body.imagePath),
    prompt:
      typeof body.prompt === "string" ? body.prompt : prompt,
    model:
      typeof body.model === "string" ? body.model : "gpt-image-2",
    size:
      typeof body.size === "string" ? body.size : "1024x1024",
    quality:
      typeof body.quality === "string" ? body.quality : "medium",
  };
}

export async function testServer(baseUrl: string): Promise<HealthResponse> {
  const response = await fetchWithTimeout(
    baseUrl,
    "/health",
    {},
    undefined,
    HEALTH_TIMEOUT_MS,
  );
  const body = await readJson(response);

  if (!response.ok || body.ok !== true) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : "The server did not pass the health check.",
    );
  }

  return body as unknown as HealthResponse;
}
