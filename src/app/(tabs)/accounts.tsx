import React, { useMemo, useRef, useState } from "react";
import { ActionSheetIOS, Alert, findNodeHandle, Pressable, ScrollView, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useApp } from "@/store/AppContext";
import { useTheme } from "@/theme/ThemeContext";
import { spacing } from "@/theme/tokens";
import { Btn, Card, Muted, Title } from "@/components/ui";
import { Host, Menu, Button as UIButton, Text as UIText } from "@expo/ui/swift-ui";
import { foregroundStyle } from "@expo/ui/swift-ui/modifiers";
import { SheetHost } from "@/components/SheetHost";
import AccountForm from "@/components/AccountForm";
import { deleteAccount, saveAccount } from "@/db/repo";
import { formatMoney } from "@/finance/money";
import { latestKnownPosition } from "@/finance/calculations";

const COLORS = ["#2F9E63", "#4CB782", "#C9A24B", "#8A6FB8", "#4E8AA8", "#E07864", "#9E9EA8"];

export default function Accounts() {
  const { theme } = useTheme();
  const db = useSQLiteContext();
  const app = useApp();
  const { accounts, snapshots, fx, reportingCurrency, locale } = app;
  const [showArchived, setShowArchived] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const rowRefs = useRef<Record<string, number | null>>({});

  const openNew = () => {
    setEditingId(undefined);
    setAcctOpen(true);
  };
  const openEdit = (id: string) => {
    setEditingId(id);
    setAcctOpen(true);
  };

  const lkp = useMemo(
    () => latestKnownPosition([...snapshots].sort((a, b) => +new Date(a.observedAt) - +new Date(b.observedAt)), accounts, fx),
    [snapshots, accounts, fx]
  );

  const visible = accounts.filter((a) => (showArchived ? true : a.archived === 0));
  const grouped = useMemo(() => {
    const m = new Map<string, typeof visible>();
    for (const a of visible) {
      if (!m.has(a.category)) m.set(a.category, []);
      m.get(a.category)!.push(a);
    }
    return [...m.entries()];
  }, [visible]);

  const archive = async (id: string, arch: boolean) => {
    const a = accounts.find((x) => x.id === id);
    if (!a) return;
    await saveAccount(db, { ...a, archived: arch ? 1 : 0 });
    await app.refresh();
  };

  const remove = (id: string) => {
    Alert.alert("Delete account?", "Snapshots referencing it will block deletion unless you force-remove its observations too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteAccount(db, id, false);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "";
            if (msg === "ACCOUNT_HAS_HISTORY") {
              Alert.alert("Has history", "This account has snapshot observations. Delete anyway and remove its observations?", [
                { text: "Keep", style: "cancel" },
                {
                  text: "Delete all", style: "destructive",
                  onPress: async () => { await deleteAccount(db, id, true); await app.refresh(); },
                },
              ]);
              return;
            }
          }
          await app.refresh();
        },
      },
    ]);
  };

  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.l, paddingBottom: 16 }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Title>Accounts</Title>
          <Pressable onPress={() => setShowArchived((v) => !v)}>
            <Text style={{ color: theme.primary }}>{showArchived ? "Hide archived" : "Show archived"}</Text>
          </Pressable>
        </View>
        <View style={{ marginVertical: 10 }}>
          <Btn label="+ New account" onPress={openNew} />
        </View>

        {grouped.map(([cat, list]) => (
          <View key={cat} style={{ marginBottom: 8 }}>
            <Muted style={{ marginBottom: 6, fontWeight: "700" }}>{cat.toUpperCase()}</Muted>
            {list.map((a) => {
              const pos = lkp.byAccount[a.id];
              const archLabel = a.archived ? "Restore" : "Archive";
              const openActions = () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                ActionSheetIOS.showActionSheetWithOptions(
                  {
                    options: ["Cancel", "Edit", archLabel, "Delete"],
                    cancelButtonIndex: 0,
                    destructiveButtonIndex: 3,
                    anchor: rowRefs.current[a.id] ?? undefined,
                  },
                  (idx) => {
                    if (idx === 1) openEdit(a.id);
                    else if (idx === 2) archive(a.id, !a.archived);
                    else if (idx === 3) remove(a.id);
                  }
                );
              };
              return (
                <View
                  key={a.id}
                  style={{ backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8, opacity: a.archived ? 0.6 : 1 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Pressable
                      style={{ flex: 1 }}
                      onPress={() => router.push(`/account/${a.id}`)}
                      onLongPress={openActions}
                      ref={(el) => {
                        rowRefs.current[a.id] = el ? findNodeHandle(el) : null;
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: a.color ?? COLORS[0], marginRight: 8 }} />
                        <Text style={{ color: theme.text, fontWeight: "700", flex: 1 }}>{a.name}{a.archived ? " (archived)" : ""}</Text>
                        <Text style={{ color: theme.text, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                          {pos ? formatMoney(pos.converted, reportingCurrency, locale) : "—"}
                        </Text>
                      </View>
                      <Muted>
                        {a.kind} · {a.currency}
                        {pos ? ` · as of ${pos.observedAt.slice(0, 10)}` : " · never observed (not zero)"}
                      </Muted>
                    </Pressable>
                    <Host style={{ width: 44, height: 44 }}>
                      <Menu
                        label={
                          <UIText modifiers={[foregroundStyle(theme.muted)]}>•••</UIText>
                        }
                      >
                        <UIButton
                          label="Edit"
                          systemImage="pencil"
                          onPress={() => openEdit(a.id)}
                        />
                        <UIButton
                          label={archLabel}
                          systemImage="archivebox"
                          onPress={() => archive(a.id, !a.archived)}
                        />
                        <UIButton
                          label="Delete"
                          systemImage="trash"
                          role="destructive"
                          onPress={() => remove(a.id)}
                        />
                      </Menu>
                    </Host>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        {grouped.length === 0 && (
          <Card><Muted>No accounts yet. Create your first account above.</Muted></Card>
        )}
      </ScrollView>
      <SheetHost open={acctOpen} onOpenChange={setAcctOpen}>
        <AccountForm accountId={editingId} onClose={() => setAcctOpen(false)} />
      </SheetHost>
    </View>
  );
}

