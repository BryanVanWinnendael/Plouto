import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { format } from "date-fns";
import { useApp } from "@/store/AppContext";
import { useTheme } from "@/theme/ThemeContext";
import { spacing } from "@/theme/tokens";
import { Btn, BackButton, Card, Muted, Title } from "@/components/ui";
import { deleteSnapshot, duplicateSnapshot, saveSnapshot } from "@/db/repo";
import { totalsForSnapshot } from "@/finance/calculations";
import { formatMoney, parseMoneyInput } from "@/finance/money";

export default function SnapshotDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const db = useSQLiteContext();
  const app = useApp();
  const snap = useMemo(() => app.snapshots.find((s) => s.id === id), [app.snapshots, id]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (snap) {
      setTitle(snap.title);
      setNotes(snap.notes);
      const m: Record<string, string> = {};
      for (const e of snap.entries) m[e.accountId] = e.observedBalance;
      setAmounts(m);
    }
  }, [snap?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!snap) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, padding: spacing.l }}>
        <Title>Not found</Title>
        <Btn label="Back" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const totals = totalsForSnapshot(snap, app.accountsById, app.fx, app.accounts);
  const others = app.snapshots.filter((s) => s.id !== snap.id).slice(-5);

  const saveEdits = async () => {
    const entries = [];
    for (const [accountId, raw] of Object.entries(amounts)) {
      const parsed = parseMoneyInput(raw);
      if (!parsed) { Alert.alert("Invalid amount", "Check all edited amounts."); return; }
      const acct = app.accountsById.get(accountId);
      const orig = snap.entries.find((e) => e.accountId === accountId);
      entries.push({
        accountId, observedBalance: parsed, currency: acct?.currency ?? app.reportingCurrency,
        verified: !!orig?.verified, notes: orig?.notes ?? null,
      });
    }
    await saveSnapshot(db, { id: snap.id, title, observedAt: snap.observedAt, notes, entries });
    await app.refresh();
    setEditing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.l, paddingBottom: 110 }}>
        <BackButton />
        {editing ? (
          <TextInput value={title ?? ""} onChangeText={setTitle} placeholder="Title"
            placeholderTextColor={theme.muted}
            style={{ color: theme.text, fontSize: 22, fontWeight: "700", marginTop: 8 }} />
        ) : (
          <Title style={{ marginTop: 8 }}>{snap.title || format(new Date(snap.observedAt), "d MMM yyyy, HH:mm")}</Title>
        )}
        <Muted>Observed {format(new Date(snap.observedAt), "d MMM yyyy, HH:mm")} · entered {format(new Date(snap.createdAt), "d MMM yyyy, HH:mm")}</Muted>

        <Card>
          <Muted>Net worth (recorded in this snapshot)</Muted>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
            {formatMoney(totals.netWorth, app.reportingCurrency, app.locale)}
          </Text>
          <Muted>Assets {formatMoney(totals.assets, app.reportingCurrency, app.locale)} · Liabilities {formatMoney(totals.liabilities, app.reportingCurrency, app.locale)}</Muted>
          {totals.missingAccountIds.length > 0 && (
            <Muted style={{ marginTop: 4 }}>
              Coverage: {totals.observedAccountIds.length} observed, {totals.missingAccountIds.length} not observed (excluded, not zero).
            </Muted>
          )}
        </Card>

        <Card>
          <Text style={{ color: theme.text, fontWeight: "700", marginBottom: 8 }}>Observations</Text>
          {snap.entries.map((e) => {
            const a = app.accountsById.get(e.accountId);
            return (
              <View key={e.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: theme.text, fontWeight: "600" }}>{a?.name ?? e.accountId}</Text>
                  {!editing ? (
                    <Text style={{ color: theme.text, fontVariant: ["tabular-nums"] }}>{formatMoney(e.observedBalance, e.currency, app.locale)}</Text>
                  ) : (
                    <TextInput
                      value={amounts[e.accountId] ?? ""}
                      onChangeText={(t) => setAmounts((p) => ({ ...p, [e.accountId]: t }))}
                      keyboardType="decimal-pad"
                      style={{ backgroundColor: theme.surface2, color: theme.text, borderRadius: 8, padding: 8, minWidth: 120, textAlign: "right" }}
                    />
                  )}
                </View>
                <Muted>{a?.category} · original {e.currency}</Muted>
              </View>
            );
          })}
          {editing && (
            <Muted style={{ marginTop: 8 }}>Removing an observation below excludes it (not zero). To remove, delete the snapshot line via re-save without it — contact-free: clear the field is invalid; use delete-snapshot flow for full removal.</Muted>
          )}
        </Card>

        {editing ? (
          <TextInput value={notes ?? ""} onChangeText={setNotes} placeholder="Notes" placeholderTextColor={theme.muted}
            style={{ backgroundColor: theme.surface, color: theme.text, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 8 }} />
        ) : snap.notes ? (
          <Card><Muted>{snap.notes}</Muted></Card>
        ) : null}

        <View style={{ gap: 8 }}>
          {editing ? (
            <>
              <Btn label="Save corrections" onPress={saveEdits} />
              <Btn label="Cancel" variant="ghost" onPress={() => setEditing(false)} />
            </>
          ) : (
            <>
              <Btn label="Edit title, notes & amounts" variant="ghost" onPress={() => setEditing(true)} />
              <Btn
                label="Duplicate as new snapshot"
                variant="ghost"
                onPress={async () => {
                  const newId = await duplicateSnapshot(db, snap.id, new Date().toISOString());
                  await app.refresh();
                  router.push(`/snapshot/${newId}`);
                }}
              />
              {others.length > 0 && (
                <Card>
                  <Text style={{ color: theme.text, fontWeight: "700", marginBottom: 6 }}>Compare with…</Text>
                  {others.map((o) => (
                    <Pressable key={o.id} onPress={() => router.push(`/snapshot/compare?a=${snap.id}&b=${o.id}`)} style={{ paddingVertical: 6 }}>
                      <Text style={{ color: theme.primary }}>{o.title || format(new Date(o.observedAt), "d MMM yyyy")}</Text>
                    </Pressable>
                  ))}
                </Card>
              )}
              <Btn
                label="Delete snapshot"
                variant="danger"
                onPress={() => Alert.alert("Delete snapshot?", "Its observations will be removed. Accounts are preserved.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: async () => { await deleteSnapshot(db, snap.id); await app.refresh(); router.back(); } },
                ])}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
