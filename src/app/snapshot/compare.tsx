import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { format } from "date-fns";
import { useApp } from "@/store/AppContext";
import { useTheme } from "@/theme/ThemeContext";
import { spacing } from "@/theme/tokens";
import { BackButton, Card, Chip, Muted, Title } from "@/components/ui";
import { compareSnapshots } from "@/finance/compare";
import { formatMoney } from "@/finance/money";
import { toDecimal } from "@/finance/money";

export default function Compare() {
  const { a, b } = useLocalSearchParams<{ a: string; b: string }>();
  const { theme } = useTheme();
  const app = useApp();
  const [sort, setSort] = useState<"increase" | "decrease" | "name">("increase");
  const [commonOnly, setCommonOnly] = useState(true);

  const sa = useMemo(() => app.snapshots.find((s) => s.id === a), [app.snapshots, a]);
  const sb = useMemo(() => app.snapshots.find((s) => s.id === b), [app.snapshots, b]);
  const result = useMemo(
    () => (sa && sb ? compareSnapshots(sa, sb, app.accountsById, app.fx, sort) : null),
    [sa, sb, app.accountsById, app.fx, sort]
  );

  if (!sa || !sb || !result) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, padding: spacing.l }}>
        <Title>Select two snapshots</Title>
        <Muted>Open History, select two snapshots, then compare.</Muted>
        <BackButton />
      </SafeAreaView>
    );
  }

  const rows = commonOnly ? result.rows.filter((r) => r.inBoth) : result.rows;
  const up = toDecimal(result.netWorthChange).gte(0);

  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: spacing.l, paddingBottom: 16 }}
      >
        <BackButton />
        <Title>Compare</Title>
        <Muted>{format(new Date(sa.observedAt), "d MMM yyyy")} → {format(new Date(sb.observedAt), "d MMM yyyy")}</Muted>

        <Card>
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              <Muted>A · {format(new Date(sa.observedAt), "d MMM")}</Muted>
              <Text style={{ color: theme.text, fontWeight: "800", fontSize: 17 }}>{formatMoney(result.aTotals.netWorth, app.reportingCurrency, app.locale)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Muted>B · {format(new Date(sb.observedAt), "d MMM")}</Muted>
              <Text style={{ color: theme.text, fontWeight: "800", fontSize: 17 }}>{formatMoney(result.bTotals.netWorth, app.reportingCurrency, app.locale)}</Text>
            </View>
          </View>
          <Text style={{ color: up ? theme.gain : theme.loss, fontWeight: "800", fontSize: 20, marginTop: 8 }}>
            {up ? "+" : ""}{formatMoney(result.netWorthChange, app.reportingCurrency, app.locale)}
            {result.netWorthPct !== null ? ` (${Number(result.netWorthPct).toFixed(1)}%)` : " (no % — baseline zero)"}
          </Text>
          <Muted>Change in recorded net worth — not labeled as investment return.</Muted>
        </Card>

        <View style={{ flexDirection: "row", marginBottom: 8 }}>
          <Chip label="Common only" active={commonOnly} onPress={() => setCommonOnly(true)} />
          <Chip label="All rows" active={!commonOnly} onPress={() => setCommonOnly(false)} />
        </View>
        {!commonOnly && (
          <Muted style={{ marginBottom: 8 }}>
            {result.onlyInA.length} only in A · {result.onlyInB.length} only in B — missing is not zero. Common-only mode compares like-for-like.
          </Muted>
        )}
        <View style={{ flexDirection: "row", marginBottom: 8 }}>
          {(["increase", "decrease", "name"] as const).map((s) => (
            <Chip key={s} label={s} active={sort === s} onPress={() => setSort(s)} />
          ))}
        </View>

        {rows.map((r) => (
          <View key={r.accountId} style={{ backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.text, fontWeight: "700" }}>{r.name}</Text>
              <Text style={{ color: r.change === null ? theme.muted : toDecimal(r.change).gte(0) ? theme.gain : theme.loss, fontWeight: "700" }}>
                {r.change === null ? "n/a" : `${toDecimal(r.change).gte(0) ? "+" : ""}${formatMoney(r.change, app.reportingCurrency, app.locale)}`}
              </Text>
            </View>
            <Muted>
              {r.a === null ? "missing in A" : formatMoney(r.a, app.reportingCurrency, app.locale)} → {r.b === null ? "missing in B" : formatMoney(r.b, app.reportingCurrency, app.locale)}
              {r.pct !== null ? ` · ${Number(r.pct).toFixed(1)}%` : ""}
              {!r.inBoth ? " · not in both — excluded from like-for-like" : ""}
            </Muted>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
