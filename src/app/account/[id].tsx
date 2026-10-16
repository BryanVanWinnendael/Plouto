import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { format } from "date-fns";
import { useApp } from "@/store/AppContext";
import { useTheme } from "@/theme/ThemeContext";
import { spacing } from "@/theme/tokens";
import { BackButton, Muted, Title } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { formatMoney, formatMoneyCompact, pctChange, toDecimal } from "@/finance/money";

export default function AccountDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const app = useApp();
  const account = useMemo(() => app.accounts.find((a) => a.id === id), [app.accounts, id]);
  const scrollRef = useRef<ScrollView>(null);
  const setChartTouch = useCallback((v: boolean) => {
    scrollRef.current?.setNativeProps({ scrollEnabled: !v });
  }, []);

  const points = useMemo(() => {
    if (!account) return [];
    return [...app.snapshots]
      .sort((a, b) => +new Date(a.observedAt) - +new Date(b.observedAt))
      .flatMap((s) => {
        const e = s.entries.find((x) => x.accountId === account.id);
        if (!e) return [];
        const c = app.fx.convert(e.observedBalance, e.currency, s.observedAt);
        if (c === null) return [];
        return [{ label: format(new Date(s.observedAt), "d MMM yy"), value: c, key: s.id, at: s.observedAt }];
      });
  }, [account, app.snapshots, app.fx]);

  if (!account) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, padding: spacing.l }}>
        <Title>Not found</Title>
      </SafeAreaView>
    );
  }

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const chg = last && prev ? toDecimal(last.value).minus(toDecimal(prev.value)).toString() : null;
  const pct = last && prev ? pctChange(last.value, prev.value) : null;
  const stale = last ? Date.now() - +new Date((last as unknown as { at: string }).at) > 45 * 24 * 3600 * 1000 : true;

  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.l, paddingBottom: 16 }}
      >
        <BackButton />
        <Title style={{ marginTop: 8 }}>{account.name}</Title>
        <Muted>{account.kind} · {account.category} · {account.currency}{account.institution ? ` · ${account.institution}` : ""}</Muted>

        <View style={{ marginBottom: spacing.xl, marginTop: spacing.s }}>
          <Muted style={{ marginBottom: 6 }}>Latest recorded balance{last ? ` · as of ${format(new Date((last as unknown as { at: string }).at), "d MMM yyyy")}` : ""}</Muted>
          <Text style={{ color: theme.text, fontSize: 32, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
            {last ? formatMoney(last.value, app.reportingCurrency, app.locale) : "Never observed (not zero)"}
          </Text>
          {chg && (
            <Text style={{ color: toDecimal(chg).gte(0) ? theme.gain : theme.loss, fontWeight: "700", marginTop: 6 }}>
              {toDecimal(chg).gte(0) ? "+" : ""}{formatMoney(chg, app.reportingCurrency, app.locale)}
              {pct !== null ? ` (${Number(pct).toFixed(1)}%)` : ""}
            </Text>
          )}
          {stale && last && <Muted style={{ color: theme.warn, marginTop: 6 }}>Stale — last observation over 45 days ago. Not a live balance.</Muted>}
        </View>

        <View style={{ marginBottom: spacing.l }}>
          <LineChart
            points={points}
            formatY={(v) => formatMoney(v, app.reportingCurrency, app.locale)}
            formatAxis={(v) => formatMoneyCompact(v, app.reportingCurrency, app.locale)}
            onTouchStateChange={setChartTouch}
          />
        </View>

        {account.notes ? <Muted style={{ marginBottom: spacing.l }}>{account.notes}</Muted> : null}
        <View style={{ height: 8 }} />
      </ScrollView>
    </View>
  );
}
