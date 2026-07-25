export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  isError?: boolean;
  imageUrl?: string;
  imagePrompt?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export type ThemePreference = "system" | "light" | "dark";

export interface AppSettings {
  apiBaseUrl: string;
  theme: ThemePreference;
}

export interface ColorPalette {
  mode: "light" | "dark";
  background: string;
  surface: string;
  elevated: string;
  text: string;
  muted: string;
  faint: string;
  border: string;
  primary: string;
  primaryPressed: string;
  userBubble: string;
  userText: string;
  danger: string;
  codeBackground: string;
  overlay: string;
}
