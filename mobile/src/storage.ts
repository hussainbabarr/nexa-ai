import AsyncStorage from "@react-native-async-storage/async-storage";

import { type AppSettings, type Conversation } from "./types";

const CONVERSATIONS_KEY = "@nexa-ai/conversations-v1";
const SETTINGS_KEY = "@nexa-ai/settings-v1";

export async function loadConversations(): Promise<Conversation[]> {
  try {
    const value = await AsyncStorage.getItem(CONVERSATIONS_KEY);
    return value ? (JSON.parse(value) as Conversation[]) : [];
  } catch {
    return [];
  }
}

export async function saveConversations(conversations: Conversation[]) {
  await AsyncStorage.setItem(
    CONVERSATIONS_KEY,
    JSON.stringify(conversations.slice(0, 100)),
  );
}

export async function loadSettings(
  defaults: AppSettings,
): Promise<AppSettings> {
  try {
    const value = await AsyncStorage.getItem(SETTINGS_KEY);
    return value
      ? {
          ...defaults,
          ...(JSON.parse(value) as Partial<AppSettings>),
        }
      : defaults;
  } catch {
    return defaults;
  }
}

export async function saveSettings(settings: AppSettings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
