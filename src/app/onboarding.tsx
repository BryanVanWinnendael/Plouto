import React, { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useApp } from "@/store/AppContext";
import { useTheme } from "@/theme/ThemeContext";
import { spacing } from "@/theme/tokens";
import { Btn, Card, Chip, Muted, Title } from "@/components/ui";
import { setSetting } from "@/db/repo";
import { seedDemo } from "@/lib/demo";

export default function Onboarding() {
  const { theme, setMode, mode } = useTheme();
  const db = useSQLiteContext();
  const app = useApp();
  const [currency, setCurrency] = useState(app.reportingCurrency || "USD");
  const [step, setStep] = useState(0);

  const finish = async (withDemo: boolean) => {
    await setSetting(db, "reportingCurrency", currency.toUpperCase() || "USD");
    await app.setReportingCurrency(currency.toUpperCase() || "USD");
    if (withDemo) await seedDemo(db, currency.toUpperCase() || "USD");
    await setSetting(db, "onboarded", "1");
    await app.refresh();
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <Text style={{ fontSize: 44, color: theme.text }}>◈</Text>
        <Title style={{ fontSize: 30, marginTop: 8 }}>Plouto</Title>
        <Text style={{ color: theme.muted, fontSize: 16, marginTop: 8, lineHeight: 24 }}>
          Track your wealth on your terms. Add your accounts, record balances whenever you want, and see how your net worth evolves. Your financial data stays on this device.
        </Text>

        {step === 0 && (
          <Card>
            <Text style={{ color: theme.text, fontWeight: "700" }}>Reporting currency</Text>
            <TextInput
              value={currency} onChangeText={(t) => setCurrency(t.toUpperCase())} maxLength={3} autoCapitalize="characters"
              style={{ backgroundColor: theme.surface2, color: theme.text, borderRadius: 10, padding: 12, marginTop: 8, textAlign: "center", fontSize: 18, fontWeight: "700" }}
            />
            <Text style={{ color: theme.text, fontWeight: "700", marginTop: 12 }}>Theme</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {(["light", "dark", "system"] as const).map((m) => (
                <Chip key={m} label={m} active={mode === m} onPress={() => setMode(m)} />
              ))}
            </View>
            <View style={{ marginTop: 16 }}>
              <Btn label="Continue" onPress={() => setStep(1)} />
            </View>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <Text style={{ color: theme.text, fontWeight: "700", fontSize: 17 }}>How it works</Text>
            <Muted style={{ marginTop: 8, lineHeight: 20 }}>
              1. Create accounts (bank, investments, crypto, loans…).{"\n"}
              2. Tap “New snapshot” whenever you check balances — no schedule required.{"\n"}
              3. Include only the accounts you checked. Missing ≠ zero.{"\n"}
              4. Compare snapshots, see allocation, review each year.
            </Muted>
            <View style={{ marginTop: 14, gap: 8 }}>
              <Btn label="Start fresh" onPress={() => finish(false)} />
              <Btn label="Explore with demo data" variant="ghost" onPress={() => finish(true)} />
              <Muted>Demo data is clearly labeled and can be removed anytime from History.</Muted>
            </View>
          </Card>
        )}

        <Btn label="Skip — start using the app" variant="ghost" onPress={() => finish(false)} />
      </ScrollView>
    </SafeAreaView>
  );
}
