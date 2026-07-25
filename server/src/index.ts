import "dotenv/config";

import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import Groq from "groq-sdk";
import helmet from "helmet";
import OpenAI from "openai";
import { z } from "zod";

const app = express();
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const chatProvider =
  process.env.CHAT_PROVIDER?.trim().toLowerCase() === "openai"
    ? "openai"
    : "groq";
const groqModel =
  process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
const openAIModel = process.env.OPENAI_MODEL?.trim() || "gpt-5.6";
const model = chatProvider === "groq" ? groqModel : openAIModel;
const imageModel = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
const generatedDirectory =
  process.env.VERCEL === "1"
    ? path.join("/tmp", "nexa-ai-generated")
    : path.resolve(process.cwd(), "generated");
const publicDirectory = path.resolve(process.cwd(), "public");
const systemInstructions =
  "You are Nexa AI, a helpful mobile assistant. Give clear, accurate, well-structured answers. Match the user's language. If the user writes in Roman Urdu, answer naturally in Roman Urdu. For coding requests, provide complete, secure, readable code with concise setup instructions. State uncertainty when needed and never claim to be the official ChatGPT app.";

mkdirSync(generatedDirectory, { recursive: true });

const allowedOrigins =
  process.env.APP_ORIGIN && process.env.APP_ORIGIN !== "*"
    ? process.env.APP_ORIGIN.split(",").map((origin) => origin.trim())
    : true;

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(
  "/generated",
  express.static(generatedDirectory, {
    immutable: true,
    maxAge: "7d",
  }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number.parseInt(process.env.RATE_LIMIT_MAX ?? "60", 10),
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);

const messageSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(12_000),
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
});

const imageSchema = z.object({
  prompt: z.string().trim().min(3).max(4_000),
  size: z
    .enum(["1024x1024", "1536x1024", "1024x1536"])
    .default("1024x1024"),
  quality: z.enum(["low", "medium", "high"]).default("medium"),
});

function hasRealKey(value: string | undefined, placeholder: string) {
  return Boolean(value?.trim() && value.trim() !== placeholder);
}

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!hasRealKey(apiKey, "gsk-your-new-key-here")) {
    throw new Error(
      "GROQ_API_KEY is missing. Add a new Groq key to server/.env.",
    );
  }

  return new Groq({ apiKey, maxRetries: 1, timeout: 40_000 });
}

function getOpenAIChatClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!hasRealKey(apiKey, "sk-your-key-here")) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add an OpenAI key to server/.env or use CHAT_PROVIDER=groq.",
    );
  }

  return new OpenAI({ apiKey, maxRetries: 1, timeout: 40_000 });
}

function getOpenAIImageClient() {
  const dedicatedImageKey = process.env.OPENAI_IMAGE_API_KEY?.trim();
  const sharedOpenAIKey = process.env.OPENAI_API_KEY?.trim();
  const apiKey = hasRealKey(
    dedicatedImageKey,
    "sk-your-image-key-here",
  )
    ? dedicatedImageKey
    : hasRealKey(sharedOpenAIKey, "sk-your-key-here")
      ? sharedOpenAIKey
      : undefined;

  if (!apiKey) {
    throw new Error(
      "Image generation needs a separate OpenAI API key. Add OPENAI_IMAGE_API_KEY to server/.env. Your Groq key only supports chat and code in this app.",
    );
  }

  return new OpenAI({ apiKey, maxRetries: 1, timeout: 110_000 });
}

app.get("/health", (_request, response) => {
  const chatConfigured =
    chatProvider === "groq"
      ? hasRealKey(process.env.GROQ_API_KEY, "gsk-your-new-key-here")
      : hasRealKey(process.env.OPENAI_API_KEY, "sk-your-key-here");
  const imageConfigured =
    hasRealKey(
      process.env.OPENAI_IMAGE_API_KEY,
      "sk-your-image-key-here",
    ) || hasRealKey(process.env.OPENAI_API_KEY, "sk-your-key-here");

  response.json({
    ok: true,
    configured: chatConfigured,
    chatConfigured,
    chatProvider,
    model,
    imageConfigured,
    imageModel,
    service: "Nexa AI API",
  });
});

app.get("/app-config", (_request, response) => {
  const whatsappUrl = process.env.CONTACT_WHATSAPP_URL?.trim();

  response.json({
    whatsappUrl:
      whatsappUrl?.startsWith("https://wa.me/") ? whatsappUrl : null,
  });
});

app.post("/api/chat", async (request, response, next) => {
  try {
    const parsed = chatSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({
        error: "Invalid chat request.",
        details: parsed.error.flatten(),
      });
      return;
    }

    let text: string | undefined;
    let responseId: string;
    let responseModel: string;

    if (chatProvider === "groq") {
      const groq = getGroqClient();
      const result = await groq.chat.completions.create({
        model: groqModel,
        messages: [
          {
            role: "system",
            content: systemInstructions,
          },
          ...parsed.data.messages.map(({ role, content }) => ({
            role,
            content,
          })),
        ],
        max_completion_tokens: 3_000,
      });
      const content = result.choices[0]?.message.content;
      text = typeof content === "string" ? content.trim() : undefined;
      responseId = result.id;
      responseModel = result.model;
    } else {
      const openai = getOpenAIChatClient();
      const result = await openai.responses.create({
        model: openAIModel,
        instructions: systemInstructions,
        input: parsed.data.messages.map(({ role, content }) => ({
          role,
          content,
        })),
        max_output_tokens: 3_000,
        store: false,
      });
      text = result.output_text?.trim();
      responseId = result.id;
      responseModel = result.model;
    }

    if (!text) {
      response.status(502).json({
        error: "The AI returned an empty response. Please try again.",
      });
      return;
    }

    response.json({
      text,
      responseId,
      model: responseModel,
      provider: chatProvider,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/image", async (request, response, next) => {
  try {
    const parsed = imageSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({
        error: "Invalid image request.",
        details: parsed.error.flatten(),
      });
      return;
    }

    const openai = getOpenAIImageClient();
    const result = await openai.images.generate({
      model: imageModel,
      prompt: parsed.data.prompt,
      size: parsed.data.size,
      quality: parsed.data.quality,
      output_format: "jpeg",
    });
    const base64 = result.data?.[0]?.b64_json;

    if (!base64) {
      response.status(502).json({
        error: "The image model returned no image. Please try again.",
      });
      return;
    }

    const filename = `nexa-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.jpg`;
    writeFileSync(
      path.join(generatedDirectory, filename),
      Buffer.from(base64, "base64"),
    );

    response.json({
      imagePath: `/generated/${filename}`,
      prompt: parsed.data.prompt,
      model: imageModel,
      size: parsed.data.size,
      quality: parsed.data.quality,
    });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(publicDirectory));
app.get(/^\/(?!api\/|health$|generated\/).*/, (_request, response) => {
  response.sendFile(path.join(publicDirectory, "index.html"));
});

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    const reportedStatus =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : undefined;

    if (reportedStatus) {
      const status = reportedStatus >= 400 ? reportedStatus : 500;
      const message = error instanceof Error ? error.message : "";

      response.status(status).json({
        error:
          status === 401
            ? "The API key configured for this request is invalid or inactive."
            : status === 429
              ? "The API rate or spending limit was reached. Please try again later."
              : message || "AI request failed.",
      });
      return;
    }

    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    console.error(error);
    response.status(500).json({ error: message });
  },
);

if (process.env.VERCEL !== "1") {
  app.listen(port, "0.0.0.0", () => {
    console.log(`Nexa AI server running on http://localhost:${port}`);

    const chatKeyConfigured =
      chatProvider === "groq"
        ? hasRealKey(process.env.GROQ_API_KEY, "gsk-your-new-key-here")
        : hasRealKey(process.env.OPENAI_API_KEY, "sk-your-key-here");

    if (!chatKeyConfigured) {
      console.warn(
        `${chatProvider === "groq" ? "GROQ_API_KEY" : "OPENAI_API_KEY"} is not set yet. Add it to server/.env before chatting.`,
      );
    }

    if (
      !hasRealKey(
        process.env.OPENAI_IMAGE_API_KEY,
        "sk-your-image-key-here",
      ) &&
      !hasRealKey(process.env.OPENAI_API_KEY, "sk-your-key-here")
    ) {
      console.warn(
        "Image generation is disabled until OPENAI_IMAGE_API_KEY is added.",
      );
    }
  });
}

export default app;
