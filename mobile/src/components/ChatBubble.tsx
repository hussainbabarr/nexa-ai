import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Markdown from "react-native-markdown-display";

import { type ChatMessage, type ColorPalette } from "../types";

interface ChatBubbleProps {
  message: ChatMessage;
  colors: ColorPalette;
}

export function ChatBubble({ message, colors }: ChatBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const isUser = message.role === "user";

  const copyMessage = async () => {
    await Clipboard.setStringAsync(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1_500);
  };

  const shareImage = async () => {
    if (!message.imageUrl || sharing) {
      return;
    }

    setSharing(true);
    try {
      const destination = `${FileSystem.cacheDirectory}nexa-ai-${Date.now()}.jpg`;
      const downloaded = await FileSystem.downloadAsync(
        message.imageUrl,
        destination,
      );

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloaded.uri, {
          mimeType: "image/jpeg",
          dialogTitle: "Share Nexa AI image",
        });
      } else {
        await Linking.openURL(message.imageUrl);
      }
    } catch {
      Alert.alert(
        "Could not share image",
        "Open the image first, then save it from your browser.",
      );
    } finally {
      setSharing(false);
    }
  };

  const markdownStyle = {
    body: {
      color: message.isError ? colors.danger : colors.text,
      fontSize: 16,
      lineHeight: 25,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 12,
    },
    heading1: {
      color: colors.text,
      fontSize: 24,
      lineHeight: 31,
      marginTop: 8,
      marginBottom: 10,
    },
    heading2: {
      color: colors.text,
      fontSize: 20,
      lineHeight: 28,
      marginTop: 8,
      marginBottom: 8,
    },
    heading3: {
      color: colors.text,
      fontSize: 18,
      lineHeight: 25,
      marginTop: 6,
      marginBottom: 6,
    },
    strong: {
      color: colors.text,
      fontWeight: "700" as const,
    },
    em: {
      color: colors.text,
      fontStyle: "italic" as const,
    },
    code_inline: {
      color: colors.text,
      backgroundColor: colors.codeBackground,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 5,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    fence: {
      color: colors.text,
      backgroundColor: colors.codeBackground,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      fontSize: 14,
      lineHeight: 21,
      marginVertical: 8,
    },
    blockquote: {
      backgroundColor: colors.surface,
      borderLeftColor: colors.primary,
      borderLeftWidth: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginVertical: 8,
    },
    bullet_list: {
      marginBottom: 10,
    },
    ordered_list: {
      marginBottom: 10,
    },
    bullet_list_icon: {
      color: colors.text,
    },
    ordered_list_icon: {
      color: colors.text,
    },
    link: {
      color: colors.primary,
      textDecorationLine: "underline" as const,
    },
  };

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View
          style={[
            styles.userBubble,
            { backgroundColor: colors.userBubble },
          ]}
        >
          <Text style={[styles.userText, { color: colors.userText }]}>
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.assistantRow}>
      <View style={[styles.avatar, { backgroundColor: colors.text }]}>
        <Text style={[styles.avatarText, { color: colors.background }]}>H</Text>
      </View>

      <View style={styles.assistantContent}>
        <Markdown style={markdownStyle}>{message.content}</Markdown>

        {message.imageUrl ? (
          <View
            style={[
              styles.imageCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Image
              source={{ uri: message.imageUrl }}
              resizeMode="cover"
              style={styles.generatedImage}
            />
            {message.imagePrompt ? (
              <Text
                numberOfLines={3}
                style={[styles.imagePrompt, { color: colors.muted }]}
              >
                {message.imagePrompt}
              </Text>
            ) : null}
            <View style={styles.imageActions}>
              <Pressable
                onPress={shareImage}
                disabled={sharing}
                style={({ pressed }) => [
                  styles.imageAction,
                  {
                    backgroundColor: colors.elevated,
                    borderColor: colors.border,
                    opacity: pressed || sharing ? 0.6 : 1,
                  },
                ]}
              >
                {sharing ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <Ionicons
                    name="share-outline"
                    color={colors.text}
                    size={17}
                  />
                )}
                <Text style={[styles.imageActionText, { color: colors.text }]}>
                  {sharing ? "Preparing" : "Share"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  message.imageUrl && Linking.openURL(message.imageUrl)
                }
                style={({ pressed }) => [
                  styles.imageAction,
                  {
                    backgroundColor: colors.elevated,
                    borderColor: colors.border,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="open-outline"
                  color={colors.text}
                  size={17}
                />
                <Text style={[styles.imageActionText, { color: colors.text }]}>
                  Open
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Pressable
          accessibilityLabel="Copy answer"
          onPress={copyMessage}
          hitSlop={10}
          style={({ pressed }) => [
            styles.copyButton,
            pressed && ({ opacity: 0.55 } as ViewStyle),
          ]}
        >
          <Ionicons
            name={copied ? "checkmark" : "copy-outline"}
            color={copied ? colors.primary : colors.muted}
            size={17}
          />
          <Text
            style={[
              styles.copyLabel,
              { color: copied ? colors.primary : colors.muted },
            ]}
          >
            {copied ? "Copied" : "Copy"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: {
    alignItems: "flex-end",
    marginBottom: 24,
    paddingLeft: 44,
  },
  userBubble: {
    borderRadius: 20,
    borderBottomRightRadius: 6,
    maxWidth: "92%",
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  userText: {
    fontSize: 16,
    lineHeight: 23,
  },
  assistantRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    marginBottom: 26,
  },
  avatar: {
    alignItems: "center",
    borderRadius: 11,
    height: 28,
    justifyContent: "center",
    marginTop: 2,
    width: 28,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "800",
  },
  assistantContent: {
    flex: 1,
  },
  copyButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 5,
    marginTop: -2,
    paddingVertical: 3,
  },
  copyLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  imageCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  generatedImage: {
    aspectRatio: 1,
    width: "100%",
  },
  imagePrompt: {
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  imageActions: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  imageAction: {
    alignItems: "center",
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 38,
  },
  imageActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
