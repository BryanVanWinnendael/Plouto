import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useApp } from "@/store/AppContext";
import { BlurView } from "expo-blur";
import { useTheme } from "@/theme/ThemeContext";
import { spacing } from "@/theme/tokens";
import { Btn, Muted, Title, useSheet } from "@/components/ui";
import { saveAccount } from "@/db/repo";
import { DEFAULT_ACCOUNT_CATEGORIES } from "@/finance/types";

/** Account create/edit form, designed to live inside a native bottom sheet. */
export default function AccountForm({ accountId, onClose }: { accountId?: string; onClose: () => void }) {
  const { theme, isDark } = useTheme();
  const sheet = useSheet();
  const db = useSQLiteContext();
  const app = useApp();
  const existing = app.accounts.find((a) => a.id === accountId);

  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<"asset" | "liability">(existing?.kind ?? "asset");
  const [category, setCategory] = useState(
    existing?.category ?? "Checking"
  );
  const [currency, setCurrency] = useState(existing?.currency ?? app.reportingCurrency);
  const [liquidity, setLiquidity] = useState<"liquid" | "semi_liquid" | "illiquid">(
    existing?.liquidity ?? "liquid"
  );

  const save = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Give the account a name.");
      return;
    }
    await saveAccount(db, {
      id: existing?.id,
      name: name.trim(),
      kind,
      category,
      currency: currency.toUpperCase() || app.reportingCurrency,
      liquidity: liquidity as "liquid",
      sortOrder: existing?.sortOrder ?? app.accounts.length,
      archived: existing?.archived ?? 0,
    });
    await app.refresh();
    onClose();
  };

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <View style={{ paddingHorizontal: spacing.l, paddingTop: spacing.s, paddingBottom: spacing.s }}>
        <BlurView
          intensity={70}
          tint={isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ color: theme.primary, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Title style={{ fontSize: 18 }}>{existing ? "Edit account" : "New account"}</Title>
          </View>
          <View style={{ width: 60 }} />
        </View>
        <Muted>You can create multiple accounts of the same type.</Muted>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.l, paddingTop: spacing.s, paddingBottom: 130 }}
        keyboardShouldPersistTaps="handled"
      >

        <Text style={{ color: theme.text, marginTop: 16, fontWeight: "600" }}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Main checking"
          placeholderTextColor={theme.muted}
          autoFocus={!existing}
          style={{
            backgroundColor: sheet.surface, color: theme.text,
            borderColor: theme.border, borderWidth: 1, borderRadius: 10,
            padding: 12, marginTop: 6, fontSize: 16,
          }}
        />

        <Text style={{ color: theme.text, marginTop: 16, fontWeight: "600" }}>Type</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          {(["asset", "liability"] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => {
                setKind(k);
                const first = DEFAULT_ACCOUNT_CATEGORIES.find((c) => c.kind === k);
                if (!existing && first) setCategory(first.name);
              }}
              style={{
                flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, alignItems: "center",
                borderColor: kind === k ? theme.primary : theme.border,
                backgroundColor: kind === k ? theme.primarySoft : sheet.surface,
              }}
            >
              <Text style={{ color: theme.text, fontWeight: kind === k ? "700" : "500" }}>
                {k === "asset" ? "Asset" : "Liability"}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={{ color: theme.text, marginTop: 16, fontWeight: "600" }}>Category</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {DEFAULT_ACCOUNT_CATEGORIES.filter((c) => c.kind === kind).map((c) => (
            <Pressable
              key={c.name}
              onPress={() => setCategory(c.name)}
              style={{
                width: "48%",
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: category === c.name ? theme.primary : theme.border,
                backgroundColor: category === c.name ? theme.primarySoft : sheet.surface,
              }}
            >
              <Text
                numberOfLines={1}
                style={{ color: theme.text, fontWeight: category === c.name ? "700" : "500", fontSize: 14 }}
              >
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: "600" }}>Currency</Text>
            <TextInput
              value={currency}
              onChangeText={setCurrency}
              autoCapitalize="characters"
              maxLength={3}
              style={{
                backgroundColor: sheet.surface, color: theme.text,
                borderColor: theme.border, borderWidth: 1, borderRadius: 10,
                padding: 12, marginTop: 6, fontSize: 16,
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: "600" }}>Liquidity</Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
              {(["liquid", "semi_liquid", "illiquid"] as const).map((l) => (
                <Pressable
                  key={l}
                  onPress={() => setLiquidity(l)}
                  style={{
                    flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, alignItems: "center",
                    borderColor: liquidity === l ? theme.primary : theme.border,
                    backgroundColor: liquidity === l ? theme.primarySoft : sheet.surface,
                  }}
                >
                  <Text numberOfLines={1} style={{ color: theme.text, fontSize: 11 }}>
                    {l.replace("_", " ")}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

      </ScrollView>
      <View
        style={{
          paddingHorizontal: spacing.l,
          paddingTop: spacing.s,
          paddingBottom: 12,
        }}
      >
        <Btn label={existing ? "Save changes" : "Create account"} onPress={save} />
      </View>
    </View>
  );
}
