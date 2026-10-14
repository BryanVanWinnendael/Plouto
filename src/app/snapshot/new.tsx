import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Host, DatePicker } from "@expo/ui/swift-ui";
import { environment } from "@expo/ui/swift-ui/modifiers";
import { BlurView } from "expo-blur";
import { format } from "date-fns";
import { useApp } from "@/store/AppContext";
import { useTheme } from "@/theme/ThemeContext";
import { spacing } from "@/theme/tokens";
import { Btn, GlassCard, Muted, Title, useSheet } from "@/components/ui";
import { saveSnapshot, type EntryInput } from "@/db/repo";
import { parseMoneyInput, formatMoney, toDecimal } from "@/finance/money";
import { sumDecimal, quantize } from "@/finance/money";

export default function NewSnapshot() {
  const { theme, isDark } = useTheme();
  const sheet = useSheet();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const app = useApp();
  const { accounts, snapshots, fx, reportingCurrency, locale } = app;

  const [observedAt, setObservedAt] = useState<Date>(new Date());
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [review, setReview] = useState(false);

  const active = useMemo(() => accounts.filter((a) => a.archived === 0), [accounts]);

  const lastByAccount = useMemo(() => {
    const m = new Map<string, { balance: string; date: string }>();
    const ordered = [...snapshots].sort((a, b) => +new Date(a.observedAt) - +new Date(b.observedAt));
    for (const s of ordered)
      for (const e of s.entries) m.set(e.accountId, { balance: e.observedBalance, date: s.observedAt });
    return m;
  }, [snapshots]);

  const grouped = useMemo(() => {
    const m = new Map<string, typeof active>();
    for (const a of active) {
      if (!m.has(a.category)) m.set(a.category, []);
      m.get(a.category)!.push(a);
    }
    return [...m.entries()];
  }, [active]);

  const liveTotals = useMemo(() => {
    const assets: string[] = [];
    const liab: string[] = [];
    for (const a of active) {
      if (!included[a.id]) continue;
      const raw = values[a.id];
      const parsed = raw ? parseMoneyInput(raw) : null;
      if (!parsed) continue;
      const c = fx.convert(parsed, a.currency, observedAt.toISOString());
      if (!c) continue;
      if (a.kind === "asset") assets.push(c);
      else liab.push(c);
    }
    const A = quantize(sumDecimal(assets), reportingCurrency);
    const L = quantize(sumDecimal(liab), reportingCurrency);
    return { A, L, N: quantize(toDecimal(A).minus(toDecimal(L)).toString(), reportingCurrency) };
  }, [active, included, values, fx, observedAt, reportingCurrency]);

  const save = async () => {
    const entries: EntryInput[] = [];
    for (const a of active) {
      if (!included[a.id]) continue;
      const parsed = parseMoneyInput(values[a.id] ?? "");
      if (!parsed) {
        Alert.alert("Invalid amount", `Check the amount for ${a.name}.`);
        return;
      }
      entries.push({
        accountId: a.id, observedBalance: parsed, currency: a.currency,
        verified: false,
      });
    }
    if (entries.length === 0) { Alert.alert("Nothing included", "Include at least one account."); return; }
    const obsDate = observedAt;
    // Duplicate detection: same calendar minute already exists?
    const sameMinute = snapshots.some((s) => s.observedAt.slice(0, 16) === obsDate.toISOString().slice(0, 16));
    const doSave = async () => {
      await saveSnapshot(db, {
        title: title.trim() || null, observedAt: obsDate.toISOString(),
        notes: notes.trim() || null, entries,
      });
      await app.refresh();
      router.back();
    };
    if (sameMinute) {
      Alert.alert("Duplicate time?", "A snapshot already exists at this observation time. Save anyway?", [
        { text: "Cancel", style: "cancel" },
        { text: "Save anyway", onPress: doSave },
      ]);
    } else {
      await doSave();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: sheet.bg }}>
      <View style={{ paddingHorizontal: spacing.l, paddingTop: spacing.s, paddingBottom: spacing.s }}>
        <BlurView
          intensity={70}
          tint={isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"}
          style={StyleSheet.absoluteFill}
        />
        <Title>{review ? "Review snapshot" : "New snapshot"}</Title>
        <Muted>Only included accounts are recorded. Absent ≠ zero.</Muted>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.l, paddingTop: spacing.s, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
        {!review ? (
          <>
            <GlassCard>
              <Text style={{ color: theme.text, fontWeight: "700" }}>Observation date & time</Text>
              <Host style={{ width: "100%", height: 48 }}>
                <DatePicker
                  title="Observed"
                  selection={observedAt}
                  displayedComponents={["date", "hourAndMinute"]}
                  onDateChange={setObservedAt}
                  modifiers={[environment("colorScheme", isDark ? "dark" : "light")]}
                />
              </Host>
              <Muted>Defaults to now. Change it when recording history. Both observation time and entry time are preserved.</Muted>
              <Text style={{ color: theme.text, fontWeight: "700", marginTop: 10 }}>Title (optional)</Text>
              <TextInput value={title} onChangeText={setTitle} placeholder="e.g. End of month"
                placeholderTextColor={theme.muted}
                style={{ backgroundColor: sheet.surface2, color: theme.text, borderRadius: 8, padding: 10, marginTop: 6 }} />
            </GlassCard>

            {grouped.map(([cat, list]) => (
              <View key={cat} style={{ marginBottom: 8 }}>
                <Muted style={{ fontWeight: "700", marginBottom: 6 }}>{cat.toUpperCase()}</Muted>
                {list.map((a) => {
                  const last = lastByAccount.get(a.id);
                  const on = !!included[a.id];
                  return (
                    <View key={a.id} style={{ backgroundColor: sheet.surface, borderColor: on ? theme.primary : theme.border, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Pressable
                          accessibilityLabel={`Include ${a.name}`}
                          onPress={() => setIncluded((p) => ({ ...p, [a.id]: !p[a.id] }))}
                          style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: on ? theme.primary : theme.border, backgroundColor: on ? theme.primary : "transparent", marginRight: 10, alignItems: "center", justifyContent: "center" }}
                        >
                          {on && <Text style={{ color: "#fff", fontWeight: "800" }}>✓</Text>}
                        </Pressable>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.text, fontWeight: "700" }}>{a.name}</Text>
                          <Muted>
                            Last: {last ? `${formatMoney(last.balance, a.currency, locale)} · ${format(new Date(last.date), "d MMM yyyy")}` : "never recorded"}
                          </Muted>
                        </View>
                      </View>
                      {on && (
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                          <TextInput
                            value={values[a.id] ?? ""}
                            onChangeText={(t) => setValues((p) => ({ ...p, [a.id]: t }))}
                            keyboardType="decimal-pad"
                            placeholder={`0.00 ${a.currency}`}
                            placeholderTextColor={theme.muted}
                            style={{ flex: 1, backgroundColor: sheet.surface2, color: theme.text, borderRadius: 8, padding: 12, fontSize: 17, fontVariant: ["tabular-nums"] }}
                          />
                          <Text style={{ color: theme.muted, marginLeft: 8 }}>{a.currency}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}

            <GlassCard>
              <Text style={{ color: theme.text, fontWeight: "700" }}>Live summary</Text>
              <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                {formatMoney(liveTotals.N, reportingCurrency, locale)}
              </Text>
              <Muted>Assets {formatMoney(liveTotals.A, reportingCurrency, locale)} · Liabilities {formatMoney(liveTotals.L, reportingCurrency, locale)}</Muted>
            </GlassCard>
          </>
        ) : (
          <GlassCard>
            <Text style={{ color: theme.text, fontWeight: "700", fontSize: 17 }}>{title || "Untitled snapshot"}</Text>
            <Muted>{observedAt.toString()} · {Object.values(included).filter(Boolean).length} accounts</Muted>
            <Text style={{ color: theme.text, fontSize: 24, fontWeight: "800", marginTop: 8 }}>
              {formatMoney(liveTotals.N, reportingCurrency, locale)}
            </Text>
            <TextInput value={notes} onChangeText={setNotes} placeholder="Notes (optional)" placeholderTextColor={theme.muted}
              style={{ backgroundColor: sheet.surface2, color: theme.text, borderRadius: 8, padding: 10, marginTop: 8 }} />
          </GlassCard>
        )}
      </ScrollView>
      <View
        style={{
          paddingHorizontal: spacing.l,
          paddingTop: spacing.s,
          paddingBottom: insets.bottom + 8,
        }}
      >
        {!review ? (
          <Btn label="Review & save" onPress={() => setReview(true)} />
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Btn label="Back" variant="ghost" onPress={() => setReview(false)} /></View>
            <View style={{ flex: 1 }}><Btn label="Save snapshot" onPress={save} /></View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
