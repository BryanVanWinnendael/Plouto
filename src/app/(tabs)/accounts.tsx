import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { router } from "expo-router";
import { useApp } from "@/store/AppContext";
import { useTheme } from "@/theme/ThemeContext";
import { spacing } from "@/theme/tokens";
import { Btn, Card, Muted, Title } from "@/components/ui";
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.l, paddingBottom: 130 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Title>Accounts</Title>
          <Pressable onPress={() => setShowArchived((v) => !v)}>
            <Text style={{ color: theme.primary }}>{showArchived ? "Hide archived" : "Show archived"}</Text>
          </Pressable>
        </View>
        <Muted>Stale values are labeled — never shown as live balances.</Muted>
        <View style={{ marginVertical: 10 }}>
          <Btn label="+ New account" onPress={openNew} />
        </View>

        {grouped.map(([cat, list]) => (
          <View key={cat} style={{ marginBottom: 8 }}>
            <Muted style={{ marginBottom: 6, fontWeight: "700" }}>{cat.toUpperCase()}</Muted>
            {list.map((a) => {
              const pos = lkp.byAccount[a.id];
              return (
                <Pressable
                  key={a.id}
                  onPress={() => router.push(`/account/${a.id}`)}
                  style={{ backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8, opacity: a.archived ? 0.6 : 1 }}
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
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                    <Pressable onPress={() => openEdit(a.id)}><Text style={{ color: theme.primary, fontSize: 12 }}>Edit</Text></Pressable>
                    <Pressable onPress={() => archive(a.id, !a.archived)}><Text style={{ color: theme.primary, fontSize: 12 }}>{a.archived ? "Restore" : "Archive"}</Text></Pressable>
                    <Pressable onPress={() => remove(a.id)}><Text style={{ color: theme.danger, fontSize: 12 }}>Delete</Text></Pressable>
                  </View>
                </Pressable>
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
    </SafeAreaView>
  );
}
