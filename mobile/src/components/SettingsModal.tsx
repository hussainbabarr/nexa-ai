import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { testServer } from "../api";
import {
  type AppSettings,
  type ColorPalette,
  type ThemePreference,
} from "../types";

interface SettingsModalProps {
  visible: boolean;
  colors: ColorPalette;
  settings: AppSettings;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
}

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: "system", label: "System", icon: "phone-portrait-outline" },
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
];

export function SettingsModal({
  visible,
  colors,
  settings,
  onClose,
  onSave,
}: SettingsModalProps) {
  const [draft, setDraft] = useState(settings);
  const [testState, setTestState] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    if (visible) {
      setDraft(settings);
      setTestState("idle");
      setTestMessage("");
    }
  }, [settings, visible]);

  const runTest = async () => {
    setTestState("testing");
    setTestMessage("Checking server...");

    try {
      const health = await testServer(draft.apiBaseUrl);
      setTestState(health.configured ? "success" : "error");
      setTestMessage(
        health.configured
          ? `Connected to ${health.chatProvider}. Chat: ${health.model}. Images: ${
              health.imageConfigured ? health.imageModel : "not configured"
            }`
          : "Server is reachable, but the API key is not configured.",
      );
    } catch (error) {
      setTestState("error");
      setTestMessage(
        error instanceof Error ? error.message : "Could not reach the server.",
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={["top", "bottom"]}
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.safeArea}
        >
          <View
            style={[styles.header, { borderBottomColor: colors.border }]}
          >
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.headerAction}
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>
                Cancel
              </Text>
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Settings
            </Text>
            <Pressable
              onPress={() =>
                onSave({
                  ...draft,
                  apiBaseUrl: draft.apiBaseUrl.trim().replace(/\/+$/, ""),
                })
              }
              disabled={!draft.apiBaseUrl.trim()}
              hitSlop={10}
              style={styles.headerAction}
            >
              <Text
                style={[
                  styles.saveText,
                  {
                    color: draft.apiBaseUrl.trim()
                      ? colors.primary
                      : colors.faint,
                  },
                ]}
              >
                Save
              </Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Appearance
            </Text>
            <View
              style={[
                styles.optionGroup,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              {themeOptions.map((option, index) => {
                const selected = draft.theme === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        theme: option.value,
                      }))
                    }
                    style={[
                      styles.optionRow,
                      index > 0 && { borderTopColor: colors.border },
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={21}
                      color={selected ? colors.primary : colors.muted}
                    />
                    <Text style={[styles.optionText, { color: colors.text }]}>
                      {option.label}
                    </Text>
                    {selected && (
                      <Ionicons
                        name="checkmark"
                        size={21}
                        color={colors.primary}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Text
              style={[
                styles.sectionTitle,
                styles.serverHeading,
                { color: colors.text },
              ]}
            >
              API server
            </Text>
            <Text style={[styles.description, { color: colors.muted }]}>
              Enter the secure HTTPS backend URL. Never enter a Groq or
              OpenAI API key here.
            </Text>

            <TextInput
              value={draft.apiBaseUrl}
              onChangeText={(apiBaseUrl) => {
                setDraft((current) => ({ ...current, apiBaseUrl }));
                setTestState("idle");
                setTestMessage("");
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://your-project.vercel.app"
              placeholderTextColor={colors.faint}
              selectionColor={colors.primary}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />

            <Pressable
              onPress={runTest}
              disabled={
                testState === "testing" || !draft.apiBaseUrl.trim()
              }
              style={({ pressed }) => [
                styles.testButton,
                {
                  backgroundColor: colors.elevated,
                  borderColor: colors.border,
                  opacity:
                    pressed ||
                    testState === "testing" ||
                    !draft.apiBaseUrl.trim()
                      ? 0.6
                      : 1,
                },
              ]}
            >
              <Ionicons
                name="pulse-outline"
                size={20}
                color={colors.text}
              />
              <Text style={[styles.testButtonText, { color: colors.text }]}>
                {testState === "testing" ? "Testing..." : "Test connection"}
              </Text>
            </Pressable>

            {testMessage ? (
              <View style={styles.statusRow}>
                <Ionicons
                  name={
                    testState === "success"
                      ? "checkmark-circle"
                      : testState === "error"
                        ? "alert-circle"
                        : "time-outline"
                  }
                  size={18}
                  color={
                    testState === "success"
                      ? colors.primary
                      : testState === "error"
                        ? colors.danger
                        : colors.muted
                  }
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        testState === "success"
                          ? colors.primary
                          : testState === "error"
                            ? colors.danger
                            : colors.muted,
                    },
                  ]}
                >
                  {testMessage}
                </Text>
              </View>
            ) : null}

            <View
              style={[
                styles.notice,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color={colors.primary}
              />
              <Text style={[styles.noticeText, { color: colors.muted }]}>
                Your API key stays on the backend and is never saved on the
                phone.
              </Text>
            </View>

            <Text style={[styles.version, { color: colors.faint }]}>
              Nexa AI v1.0.1
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 54,
    paddingHorizontal: 14,
  },
  headerAction: {
    minWidth: 56,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  cancelText: {
    fontSize: 16,
  },
  saveText: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.25,
    marginBottom: 10,
  },
  serverHeading: {
    marginTop: 30,
    marginBottom: 5,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  optionGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  optionRow: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 15,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  testButton: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 48,
  },
  testButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  statusRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 7,
    marginTop: 10,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  notice: {
    alignItems: "flex-start",
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 30,
    padding: 14,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  version: {
    fontSize: 12,
    marginTop: 26,
    textAlign: "center",
  },
});
