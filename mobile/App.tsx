import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import { requestChat, requestImage } from "./src/api";
import { ChatBubble } from "./src/components/ChatBubble";
import { SettingsModal } from "./src/components/SettingsModal";
import { Sidebar } from "./src/components/Sidebar";
import {
  loadConversations,
  loadSettings,
  saveConversations,
  saveSettings,
} from "./src/storage";
import { darkColors, lightColors } from "./src/theme";
import {
  type AppSettings,
  type ChatMessage,
  type Conversation,
} from "./src/types";

type ComposerMode = "chat" | "image";

const ANDROID_PHONE_API_URL = "http://192.168.1.4:3000";
const ANDROID_EMULATOR_API_URL = "http://10.0.2.2:3000";
const HOSTED_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim().replace(
  /\/+$/,
  "",
);
const WHATSAPP_URL =
  process.env.EXPO_PUBLIC_WHATSAPP_URL?.trim() || "https://wa.me/";

const suggestions: Array<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  prompt: string;
  mode: ComposerMode;
}> = [
  {
    icon: "bulb-outline" as const,
    title: "Explain a topic",
    prompt: "Explain artificial intelligence in simple Roman Urdu.",
    mode: "chat",
  },
  {
    icon: "code-slash-outline" as const,
    title: "Write code",
    prompt: "Write a clean Python calculator with clear comments.",
    mode: "chat",
  },
  {
    icon: "image-outline" as const,
    title: "Create an image",
    prompt: "A futuristic emerald city at sunset, cinematic digital art.",
    mode: "image",
  },
  {
    icon: "school-outline" as const,
    title: "Study smarter",
    prompt: "Make a focused study plan for my next exam.",
    mode: "chat",
  },
];

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function makeTitle(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 38 ? `${compact.slice(0, 38)}...` : compact;
}

function defaultApiUrl() {
  if (HOSTED_API_URL) {
    return HOSTED_API_URL;
  }

  if (Platform.OS === "android") {
    return ANDROID_PHONE_API_URL;
  }

  return "http://localhost:3000";
}

const defaultSettings: AppSettings = {
  apiBaseUrl: defaultApiUrl(),
  theme: "system",
};

function AppContent() {
  const systemTheme = useColorScheme();
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [hydrated, setHydrated] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [renameText, setRenameText] = useState("");
  const [composerMode, setComposerMode] = useState<ComposerMode>("chat");
  const [toolsVisible, setToolsVisible] = useState(false);
  const [proUpgradeVisible, setProUpgradeVisible] = useState(false);

  const resolvedTheme =
    settings.theme === "system"
      ? systemTheme === "dark"
        ? "dark"
        : "light"
      : settings.theme;
  const colors = resolvedTheme === "dark" ? darkColors : lightColors;

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeId) ??
      null,
    [activeId, conversations],
  );

  useEffect(() => {
    let mounted = true;

    Promise.all([
      loadConversations(),
      loadSettings(defaultSettings),
    ]).then(([storedConversations, storedSettings]) => {
      if (!mounted) {
        return;
      }

      const sorted = [...storedConversations].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
      const storedApiUrl = storedSettings.apiBaseUrl
        .trim()
        .replace(/\/+$/, "");
      const isLocalAndroidUrl =
        Platform.OS === "android" &&
        (storedApiUrl === ANDROID_EMULATOR_API_URL ||
          storedApiUrl === ANDROID_PHONE_API_URL);
      const migratedSettings =
        HOSTED_API_URL && isLocalAndroidUrl
          ? { ...storedSettings, apiBaseUrl: HOSTED_API_URL }
          : storedApiUrl === ANDROID_EMULATOR_API_URL
            ? { ...storedSettings, apiBaseUrl: ANDROID_PHONE_API_URL }
            : storedSettings;
      setConversations(sorted);
      setActiveId(sorted[0]?.id ?? null);
      setSettings(migratedSettings);
      setHydrated(true);
    });

    return () => {
      mounted = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (hydrated) {
      saveConversations(conversations).catch(() => undefined);
    }
  }, [conversations, hydrated]);

  useEffect(() => {
    if (hydrated) {
      saveSettings(settings).catch(() => undefined);
    }
  }, [hydrated, settings]);

  const updateConversation = (
    conversationId: string,
    updater: (conversation: Conversation) => Conversation,
  ) => {
    setConversations((current) =>
      current
        .map((conversation) =>
          conversation.id === conversationId
            ? updater(conversation)
            : conversation,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );
  };

  const requestAssistant = async (
    conversationId: string,
    requestMessages: ChatMessage[],
  ) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    try {
      const result = await requestChat(
        settings.apiBaseUrl,
        requestMessages.filter((message) => !message.isError),
        controller.signal,
      );

      const assistantMessage: ChatMessage = {
        id: makeId("assistant"),
        role: "assistant",
        content: result.text,
        createdAt: Date.now(),
      };

      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        messages: [...conversation.messages, assistantMessage],
        updatedAt: assistantMessage.createdAt,
      }));
    } catch (error) {
      const wasAborted =
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.toLowerCase().includes("aborted"));

      const needsPro =
        error instanceof Error &&
        (error.message.includes("Image generation needs") ||
          error.message.includes("OPENAI_IMAGE_API_KEY"));

      if (needsPro) {
        setProUpgradeVisible(true);
        return;
      }

      if (!wasAborted) {
        const errorMessage: ChatMessage = {
          id: makeId("error"),
          role: "assistant",
          content: `**Request failed**\n\n${
            error instanceof Error
              ? error.message
              : "Please check the server and try again."
          }`,
          createdAt: Date.now(),
          isError: true,
        };

        updateConversation(conversationId, (conversation) => ({
          ...conversation,
          messages: [...conversation.messages, errorMessage],
          updatedAt: errorMessage.createdAt,
        }));
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const requestGeneratedImage = async (
    conversationId: string,
    prompt: string,
  ) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    try {
      const result = await requestImage(
        settings.apiBaseUrl,
        prompt,
        controller.signal,
      );
      const assistantMessage: ChatMessage = {
        id: makeId("image"),
        role: "assistant",
        content: "Here is the image I created.",
        createdAt: Date.now(),
        imageUrl: result.imageUrl,
        imagePrompt: result.prompt,
      };

      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        messages: [...conversation.messages, assistantMessage],
        updatedAt: assistantMessage.createdAt,
      }));
    } catch (error) {
      const wasAborted =
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.toLowerCase().includes("aborted"));

      if (!wasAborted) {
        const errorMessage: ChatMessage = {
          id: makeId("image-error"),
          role: "assistant",
          content: `**Image generation failed**\n\n${
            error instanceof Error
              ? error.message
              : "Please check the server and try again."
          }`,
          createdAt: Date.now(),
          isError: true,
        };

        updateConversation(conversationId, (conversation) => ({
          ...conversation,
          messages: [...conversation.messages, errorMessage],
          updatedAt: errorMessage.createdAt,
        }));
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const sendMessage = async (providedText?: string) => {
    const text = (providedText ?? input).trim();

    if (!text || isLoading) {
      return;
    }

    Keyboard.dismiss();
    setInput("");

    const userMessage: ChatMessage = {
      id: makeId("user"),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    let conversationId = activeId;
    let requestMessages: ChatMessage[];

    if (activeConversation && conversationId) {
      requestMessages = [
        ...activeConversation.messages.filter((message) => !message.isError),
        userMessage,
      ];
      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        messages: [...conversation.messages, userMessage],
        updatedAt: userMessage.createdAt,
      }));
    } else {
      conversationId = makeId("chat");
      requestMessages = [userMessage];
      const conversation: Conversation = {
        id: conversationId,
        title: makeTitle(text),
        messages: requestMessages,
        createdAt: userMessage.createdAt,
        updatedAt: userMessage.createdAt,
      };
      setConversations((current) => [conversation, ...current]);
      setActiveId(conversationId);
    }

    requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
    await requestAssistant(conversationId, requestMessages);
  };

  const generateImage = async (providedText?: string) => {
    const prompt = (providedText ?? input).trim();

    if (!prompt || isLoading) {
      return;
    }

    Keyboard.dismiss();
    setInput("");

    const userMessage: ChatMessage = {
      id: makeId("user"),
      role: "user",
      content: prompt,
      createdAt: Date.now(),
    };
    let conversationId = activeId;

    if (activeConversation && conversationId) {
      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        messages: [...conversation.messages, userMessage],
        updatedAt: userMessage.createdAt,
      }));
    } else {
      conversationId = makeId("chat");
      const conversation: Conversation = {
        id: conversationId,
        title: makeTitle(`Image: ${prompt}`),
        messages: [userMessage],
        createdAt: userMessage.createdAt,
        updatedAt: userMessage.createdAt,
      };
      setConversations((current) => [conversation, ...current]);
      setActiveId(conversationId);
    }

    requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
    await requestGeneratedImage(conversationId, prompt);
  };

  const regenerate = async () => {
    if (!activeConversation || isLoading) {
      return;
    }

    let requestMessages = activeConversation.messages.filter(
      (message) => !message.isError,
    );

    if (requestMessages.at(-1)?.role === "assistant") {
      requestMessages = requestMessages.slice(0, -1);
    }

    if (!requestMessages.some((message) => message.role === "user")) {
      return;
    }

    const now = Date.now();
    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      messages: requestMessages,
      updatedAt: now,
    }));
    await requestAssistant(activeConversation.id, requestMessages);
  };

  const stopResponse = () => {
    abortRef.current?.abort();
  };

  const startNewChat = () => {
    abortRef.current?.abort();
    setActiveId(null);
    setInput("");
    setComposerMode("chat");
    setSidebarVisible(false);
    Keyboard.dismiss();
  };

  const deleteConversation = (id: string) => {
    const remaining = conversations.filter(
      (conversation) => conversation.id !== id,
    );
    setConversations(remaining);

    if (activeId === id) {
      setActiveId(remaining[0]?.id ?? null);
    }
  };

  const beginRename = (conversation: Conversation) => {
    setRenameTarget(conversation);
    setRenameText(conversation.title);
  };

  const commitRename = () => {
    const title = renameText.trim();

    if (!renameTarget || !title) {
      return;
    }

    updateConversation(renameTarget.id, (conversation) => ({
      ...conversation,
      title,
      updatedAt: Date.now(),
    }));
    setRenameTarget(null);
    setRenameText("");
  };

  const saveAppSettings = (nextSettings: AppSettings) => {
    setSettings(nextSettings);
    setSettingsVisible(false);
  };

  if (!hydrated) {
    return (
      <SafeAreaView
        style={[
          styles.loadingScreen,
          { backgroundColor: colors.background },
        ]}
      >
        <StatusBar style={colors.mode === "dark" ? "light" : "dark"} />
        <View style={[styles.loadingLogo, { backgroundColor: colors.text }]}>
          <Text style={[styles.loadingLogoText, { color: colors.background }]}>
            H
          </Text>
        </View>
        <ActivityIndicator color={colors.primary} size="small" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <StatusBar style={colors.mode === "dark" ? "light" : "dark"} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityLabel="Open chat history"
          onPress={() => setSidebarVisible(true)}
          style={({ pressed }) => [
            styles.headerIcon,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="menu" color={colors.text} size={25} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text
            numberOfLines={1}
            style={[styles.headerTitle, { color: colors.text }]}
          >
            {activeConversation?.title ?? "Nexa AI"}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
            AI assistant
          </Text>
        </View>

        <Pressable
          accessibilityLabel="Start a new chat"
          onPress={startNewChat}
          style={({ pressed }) => [
            styles.headerIcon,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="create-outline" color={colors.text} size={24} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 16}
        style={styles.main}
      >
        {activeConversation ? (
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: true })
            }
          >
            {activeConversation.messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                colors={colors}
              />
            ))}

            {isLoading ? (
              <View style={styles.thinkingRow}>
                <View style={[styles.thinkingAvatar, { backgroundColor: colors.text }]}>
                  <Text
                    style={[
                      styles.thinkingAvatarText,
                      { color: colors.background },
                    ]}
                  >
                    H
                  </Text>
                </View>
                <View>
                  <Text style={[styles.thinkingText, { color: colors.muted }]}>
                    {composerMode === "image"
                      ? "Creating image"
                      : "Thinking"}
                  </Text>
                  <ActivityIndicator
                    color={colors.primary}
                    size="small"
                    style={styles.thinkingSpinner}
                  />
                </View>
              </View>
            ) : null}

            {!isLoading &&
            activeConversation.messages.at(-1)?.role === "assistant" &&
            !activeConversation.messages.at(-1)?.isError &&
            !activeConversation.messages.at(-1)?.imageUrl ? (
              <Pressable
                onPress={regenerate}
                style={({ pressed }) => [
                  styles.regenerateButton,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    opacity: pressed ? 0.65 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="refresh-outline"
                  size={17}
                  color={colors.text}
                />
                <Text style={[styles.regenerateText, { color: colors.text }]}>
                  Regenerate
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.welcomeContent}
          >
            <View style={[styles.heroLogo, { backgroundColor: colors.text }]}>
              <Text style={[styles.heroLogoText, { color: colors.background }]}>
                H
              </Text>
            </View>
            <Text style={[styles.welcomeTitle, { color: colors.text }]}>
              How can I help you today?
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: colors.muted }]}>
              Ask a question, learn something new, or get help with your work.
            </Text>

            <View style={styles.suggestionGrid}>
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.title}
                  onPress={() => {
                    setComposerMode(suggestion.mode);
                    if (suggestion.mode === "image") {
                      generateImage(suggestion.prompt);
                    } else {
                      sendMessage(suggestion.prompt);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.suggestionCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.65 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={suggestion.icon}
                    size={21}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.suggestionTitle, { color: colors.text }]}
                  >
                    {suggestion.title}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[styles.suggestionText, { color: colors.muted }]}
                  >
                    {suggestion.prompt}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        <View
          style={[
            styles.composerSection,
            { backgroundColor: colors.background },
          ]}
        >
          {composerMode === "image" ? (
            <View
              style={[
                styles.modeChip,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={16}
                color={colors.primary}
              />
              <Text style={[styles.modeChipText, { color: colors.text }]}>
                Create image
              </Text>
              <Pressable
                accessibilityLabel="Exit image mode"
                hitSlop={8}
                onPress={() => setComposerMode("chat")}
              >
                <Ionicons name="close" size={17} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}

          <View
            style={[
              styles.composer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Pressable
              accessibilityLabel="Open tools"
              onPress={() => setToolsVisible(true)}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.toolButton,
                {
                  backgroundColor: colors.elevated,
                  opacity: pressed || isLoading ? 0.55 : 1,
                },
              ]}
            >
              <Ionicons name="add" size={22} color={colors.text} />
            </Pressable>

            <TextInput
              value={input}
              onChangeText={setInput}
              editable={!isLoading}
              multiline
              maxLength={12_000}
              placeholder={
                composerMode === "image"
                  ? "Describe an image"
                  : "Message Nexa AI"
              }
              placeholderTextColor={colors.faint}
              selectionColor={colors.primary}
              style={[styles.composerInput, { color: colors.text }]}
            />

            <Pressable
              accessibilityLabel={
                isLoading ? "Stop response" : "Send message"
              }
              onPress={
                isLoading
                  ? stopResponse
                  : composerMode === "image"
                    ? () => generateImage()
                    : () => sendMessage()
              }
              disabled={!isLoading && !input.trim()}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor:
                    isLoading || input.trim() ? colors.text : colors.border,
                  opacity: pressed ? 0.65 : 1,
                },
              ]}
            >
              <Ionicons
                name={isLoading ? "stop" : "arrow-up"}
                size={19}
                color={colors.background}
              />
            </Pressable>
          </View>

          <Text style={[styles.disclaimer, { color: colors.faint }]}>
            AI can make mistakes. Double-check important information.
          </Text>
          <Pressable
            accessibilityLabel="Open Hussain's WhatsApp"
            accessibilityRole="link"
            hitSlop={8}
            onPress={() => Linking.openURL(WHATSAPP_URL)}
            style={({ pressed }) => [
              styles.creditLink,
              { opacity: pressed ? 0.55 : 1 },
            ]}
          >
            <Text style={[styles.creditText, { color: colors.primary }]}>
              Designed by Hussain
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Sidebar
        visible={sidebarVisible}
        conversations={conversations}
        activeId={activeId}
        colors={colors}
        onClose={() => setSidebarVisible(false)}
        onNewChat={startNewChat}
        onSelect={(id) => {
          setActiveId(id);
          setSidebarVisible(false);
        }}
        onRename={beginRename}
        onDelete={deleteConversation}
        onOpenSettings={() => {
          setSidebarVisible(false);
          setSettingsVisible(true);
        }}
      />

      <SettingsModal
        visible={settingsVisible}
        colors={colors}
        settings={settings}
        onClose={() => setSettingsVisible(false)}
        onSave={saveAppSettings}
      />

      <Modal
        visible={proUpgradeVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setProUpgradeVisible(false)}
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 22,
            backgroundColor: colors.overlay,
          }}
        >
          <View
            style={{
              width: "100%",
              alignItems: "center",
              borderRadius: 22,
              padding: 24,
              backgroundColor: colors.elevated,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primary,
              }}
            >
              <Ionicons name="sparkles" size={28} color="#FFFFFF" />
            </View>

            <Text
              style={{
                color: colors.text,
                fontSize: 23,
                fontWeight: "700",
                marginTop: 16,
              }}
            >
              Upgrade to Nexa Pro
            </Text>

            <Text
              style={{
                color: colors.muted,
                fontSize: 14,
                lineHeight: 21,
                textAlign: "center",
                marginTop: 8,
                marginBottom: 22,
              }}
            >
              Unlock AI image generation and high-quality image output with
              Nexa Pro.
            </Text>

            <Pressable
              onPress={() => {
                setProUpgradeVisible(false);
                Alert.alert(
                  "Nexa Pro",
                  "Nexa Pro subscription will be available soon.",
                );
              }}
              style={{
                width: "100%",
                alignItems: "center",
                borderRadius: 13,
                paddingVertical: 14,
                backgroundColor: colors.primary,
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
                Upgrade to Pro
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setProUpgradeVisible(false)}
              style={{ padding: 12, marginTop: 5 }}
            >
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                Not now
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={toolsVisible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setToolsVisible(false)}
      >
        <Pressable
          onPress={() => setToolsVisible(false)}
          style={[
            styles.toolsOverlay,
            { backgroundColor: colors.overlay },
          ]}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.toolsCard, { backgroundColor: colors.elevated }]}
          >
            <Text style={[styles.toolsTitle, { color: colors.text }]}>
              Nexa AI tools
            </Text>

            <Pressable
              onPress={() => {
                setComposerMode("chat");
                setToolsVisible(false);
              }}
              style={styles.toolsOption}
            >
              <View
                style={[
                  styles.toolsIcon,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={styles.toolsOptionText}>
                <Text style={[styles.toolsOptionTitle, { color: colors.text }]}>
                  Chat
                </Text>
                <Text
                  style={[styles.toolsOptionSubtitle, { color: colors.muted }]}
                >
                  Questions, writing, learning and more
                </Text>
              </View>
              {composerMode === "chat" ? (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={colors.primary}
                />
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => {
                setComposerMode("image");
                setToolsVisible(false);
              }}
              style={styles.toolsOption}
            >
              <View
                style={[
                  styles.toolsIcon,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Ionicons
                  name="image-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={styles.toolsOptionText}>
                <Text style={[styles.toolsOptionTitle, { color: colors.text }]}>
                  Create image
                </Text>
                <Text
                  style={[styles.toolsOptionSubtitle, { color: colors.muted }]}
                >
                  Generate an AI image from your description
                </Text>
              </View>
              {composerMode === "image" ? (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={colors.primary}
                />
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => {
                setComposerMode("chat");
                setInput((current) =>
                  current.trim() ? current : "Write production-ready code for ",
                );
                setToolsVisible(false);
              }}
              style={styles.toolsOption}
            >
              <View
                style={[
                  styles.toolsIcon,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Ionicons
                  name="code-slash-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={styles.toolsOptionText}>
                <Text style={[styles.toolsOptionTitle, { color: colors.text }]}>
                  Write code
                </Text>
                <Text
                  style={[styles.toolsOptionSubtitle, { color: colors.muted }]}
                >
                  Generate, explain, debug or improve code
                </Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(renameTarget)}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setRenameTarget(null)}
      >
        <Pressable
          onPress={() => setRenameTarget(null)}
          style={[
            styles.renameOverlay,
            { backgroundColor: colors.overlay },
          ]}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.renameCard,
              { backgroundColor: colors.elevated },
            ]}
          >
            <Text style={[styles.renameTitle, { color: colors.text }]}>
              Rename chat
            </Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              maxLength={80}
              placeholder="Chat title"
              placeholderTextColor={colors.faint}
              selectionColor={colors.primary}
              onSubmitEditing={commitRename}
              style={[
                styles.renameInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />
            <View style={styles.renameActions}>
              <Pressable
                onPress={() => setRenameTarget(null)}
                style={styles.renameAction}
              >
                <Text style={[styles.renameCancel, { color: colors.text }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={commitRename}
                disabled={!renameText.trim()}
                style={[
                  styles.renameSaveButton,
                  {
                    backgroundColor: renameText.trim()
                      ? colors.primary
                      : colors.border,
                  },
                ]}
              >
                <Text style={styles.renameSave}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingScreen: {
    alignItems: "center",
    flex: 1,
    gap: 20,
    justifyContent: "center",
  },
  loadingLogo: {
    alignItems: "center",
    borderRadius: 20,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  loadingLogoText: {
    fontSize: 27,
    fontWeight: "900",
  },
  header: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    height: 58,
    paddingHorizontal: 8,
  },
  headerIcon: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  pressed: {
    opacity: 0.5,
  },
  headerCenter: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    maxWidth: "92%",
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  main: {
    flex: 1,
  },
  messagesContent: {
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  welcomeContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 36,
  },
  heroLogo: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 22,
    height: 66,
    justifyContent: "center",
    marginBottom: 24,
    width: 66,
  },
  heroLogoText: {
    fontSize: 31,
    fontWeight: "900",
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.7,
    textAlign: "center",
  },
  welcomeSubtitle: {
    alignSelf: "center",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 9,
    maxWidth: 330,
    textAlign: "center",
  },
  suggestionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginTop: 30,
  },
  suggestionCard: {
    borderRadius: 15,
    borderWidth: 1,
    minHeight: 118,
    padding: 14,
    width: "48%",
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 10,
  },
  suggestionText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  thinkingRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  thinkingAvatar: {
    alignItems: "center",
    borderRadius: 11,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  thinkingAvatarText: {
    fontSize: 14,
    fontWeight: "800",
  },
  thinkingText: {
    fontSize: 14,
    marginTop: 1,
  },
  thinkingSpinner: {
    alignSelf: "flex-start",
    marginTop: 5,
  },
  regenerateButton: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  regenerateText: {
    fontSize: 13,
    fontWeight: "600",
  },
  composerSection: {
    paddingBottom: Platform.OS === "ios" ? 7 : 10,
    paddingHorizontal: 12,
    paddingTop: 7,
  },
  modeChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    marginBottom: 7,
    marginLeft: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  composer: {
    alignItems: "flex-end",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 50,
    paddingBottom: 5,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
  },
  composerInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 135,
    minHeight: 38,
    paddingBottom: 8,
    paddingRight: 8,
    paddingTop: 8,
  },
  toolButton: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    marginBottom: 1,
    marginRight: 5,
    width: 36,
  },
  sendButton: {
    alignItems: "center",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  disclaimer: {
    fontSize: 10.5,
    marginTop: 7,
    textAlign: "center",
  },
  creditLink: {
    alignSelf: "center",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  creditText: {
    fontSize: 11,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  toolsOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 14,
  },
  toolsCard: {
    borderRadius: 20,
    gap: 2,
    paddingBottom: 10,
    paddingHorizontal: 10,
    paddingTop: 16,
  },
  toolsTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  toolsOption: {
    alignItems: "center",
    borderRadius: 13,
    flexDirection: "row",
    minHeight: 66,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  toolsIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  toolsOptionText: {
    flex: 1,
    marginHorizontal: 11,
  },
  toolsOptionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  toolsOptionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  renameOverlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 22,
  },
  renameCard: {
    borderRadius: 18,
    padding: 18,
    width: "100%",
  },
  renameTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 14,
  },
  renameInput: {
    borderRadius: 11,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 13,
  },
  renameActions: {
    flexDirection: "row",
    gap: 9,
    justifyContent: "flex-end",
    marginTop: 17,
  },
  renameAction: {
    justifyContent: "center",
    paddingHorizontal: 13,
  },
  renameCancel: {
    fontSize: 15,
    fontWeight: "600",
  },
  renameSaveButton: {
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  renameSave: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
