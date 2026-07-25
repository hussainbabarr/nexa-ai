import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type ColorPalette, type Conversation } from "../types";

interface SidebarProps {
  visible: boolean;
  conversations: Conversation[];
  activeId: string | null;
  colors: ColorPalette;
  onClose: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onRename: (conversation: Conversation) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  visible,
  conversations,
  activeId,
  colors,
  onClose,
  onNewChat,
  onSelect,
  onRename,
  onDelete,
  onOpenSettings,
}: SidebarProps) {
  const [actionConversation, setActionConversation] =
    useState<Conversation | null>(null);

  const deleteConversation = (conversation: Conversation) => {
    setActionConversation(null);
    Alert.alert(
      "Delete chat?",
      `"${conversation.title}" will be removed from this device.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDelete(conversation.id),
        },
      ],
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close sidebar"
            style={[styles.overlay, { backgroundColor: colors.overlay }]}
            onPress={onClose}
          />

          <SafeAreaView
            edges={["top", "bottom", "left"]}
            style={[styles.drawer, { backgroundColor: colors.surface }]}
          >
            <View style={styles.drawerHeader}>
              <View>
                <Text style={[styles.brand, { color: colors.text }]}>
                  Nexa AI
                </Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>
                  Your conversations
                </Text>
              </View>

              <Pressable
                accessibilityLabel="Close sidebar"
                onPress={onClose}
                hitSlop={10}
                style={styles.iconButton}
              >
                <Ionicons name="close" size={23} color={colors.text} />
              </Pressable>
            </View>

            <Pressable
              onPress={onNewChat}
              style={({ pressed }) => [
                styles.newChat,
                {
                  backgroundColor: pressed
                    ? colors.elevated
                    : colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="create-outline" size={20} color={colors.text} />
              <Text style={[styles.newChatText, { color: colors.text }]}>
                New chat
              </Text>
            </Pressable>

            <Text style={[styles.sectionLabel, { color: colors.faint }]}>
              RECENT
            </Text>

            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={
                conversations.length === 0 ? styles.emptyList : undefined
              }
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.muted }]}>
                  Your chat history will appear here.
                </Text>
              }
              renderItem={({ item }) => {
                const isActive = item.id === activeId;
                return (
                  <View
                    style={[
                      styles.chatRow,
                      isActive && { backgroundColor: colors.elevated },
                    ]}
                  >
                    <Pressable
                      onPress={() => onSelect(item.id)}
                      style={styles.chatMain}
                    >
                      <Ionicons
                        name="chatbubble-outline"
                        size={17}
                        color={colors.muted}
                      />
                      <Text
                        numberOfLines={1}
                        style={[styles.chatTitle, { color: colors.text }]}
                      >
                        {item.title}
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityLabel={`Actions for ${item.title}`}
                      onPress={() => setActionConversation(item)}
                      hitSlop={8}
                      style={styles.rowAction}
                    >
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={19}
                        color={colors.muted}
                      />
                    </Pressable>
                  </View>
                );
              }}
            />

            <Pressable
              onPress={onOpenSettings}
              style={({ pressed }) => [
                styles.settingsButton,
                {
                  borderTopColor: colors.border,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.profileCircle,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={styles.profileText}>HB</Text>
              </View>
              <View style={styles.settingsTextWrap}>
                <Text style={[styles.settingsTitle, { color: colors.text }]}>
                  Hussain Babar
                </Text>
                <Text style={[styles.settingsSubtitle, { color: colors.muted }]}>
                  Settings
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal
        visible={Boolean(actionConversation)}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setActionConversation(null)}
      >
        <Pressable
          style={[styles.actionOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => setActionConversation(null)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.actionCard, { backgroundColor: colors.elevated }]}
          >
            <Text
              numberOfLines={1}
              style={[styles.actionTitle, { color: colors.text }]}
            >
              {actionConversation?.title}
            </Text>

            <Pressable
              onPress={() => {
                if (actionConversation) {
                  const selected = actionConversation;
                  setActionConversation(null);
                  onRename(selected);
                }
              }}
              style={styles.actionItem}
            >
              <Ionicons name="pencil-outline" size={21} color={colors.text} />
              <Text style={[styles.actionText, { color: colors.text }]}>
                Rename
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                actionConversation && deleteConversation(actionConversation)
              }
              style={styles.actionItem}
            >
              <Ionicons name="trash-outline" size={21} color={colors.danger} />
              <Text style={[styles.actionText, { color: colors.danger }]}>
                Delete
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  overlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  drawer: {
    flex: 1,
    width: "88%",
  },
  drawerHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 16,
    paddingTop: 8,
  },
  brand: {
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  iconButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  newChat: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  newChatText: {
    fontSize: 15,
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 7,
    marginHorizontal: 20,
    marginTop: 22,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  chatRow: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    marginHorizontal: 8,
    minHeight: 46,
  },
  chatMain: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    paddingLeft: 12,
    paddingVertical: 12,
  },
  chatTitle: {
    flex: 1,
    fontSize: 14,
  },
  rowAction: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    marginRight: 3,
    width: 38,
  },
  settingsButton: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  profileCircle: {
    alignItems: "center",
    borderRadius: 17,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  profileText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  settingsTextWrap: {
    flex: 1,
    marginLeft: 11,
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  settingsSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  actionOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  actionCard: {
    borderRadius: 18,
    paddingBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 14,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  actionItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
