import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { format } from "date-fns";
import { useApp } from "@/store/AppContext";
import { useTheme } from "@/theme/ThemeContext";
import { spacing } from "@/theme/tokens";
import { Btn, Card, Chip, Money, Muted, Title } from "@/components/ui";
import { SheetHost } from "@/components/SheetHost";
import SnapshotForm from "@/components/SnapshotForm";
import { LineChart } from "@/components/charts";
import { filterByRange, historySeries, latestKnownPosition, totalsForSnapshot } from "@/finance/calculations";
import { formatMoney, formatMoneyCompact, formatSigned, pctChange, toDecimal } from "@/finance/money";

const RANGES: { label: string; months: number | null }[] = [
  { label: "1M", months: 1 }, { label: "3M", months: 3 }, { label: "6M", months: 6 },
  { label: "1Y", months: 12 }, { label: "3Y", months: 36 }, { label: "5Y", months: 60 },
  { label: "All", months: null },
];
const RANGE_ORDER: (number | null)[] = RANGES.map((r) => r.months);

export default function Overview() {
  const { theme } = useTheme();
  const app = useApp();
  const { accounts, snapshots, accountsById, fx, reportingCurrency, locale } = app;
  const [range, setRange] = useState<number | null>(null);
  const [showAssets, setShowAssets] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [snapOpen, setSnapOpen] = useState(false);

  /** Pinch past the chart limits steps the time range (zoom in = shorter range). */
  const stepRange = (dir: 1 | -1) => {
    setRange((cur) => {
      const i = RANGE_ORDER.findIndex((m) => m === cur);
      const ni = Math.min(RANGE_ORDER.length - 1, Math.max(0, i + (dir === 1 ? -1 : 1)));
      return RANGE_ORDER[ni];
    });
  };

  const ordered = useMemo(
    () => [...snapshots].sort((a, b) => +new Date(a.observedAt) - +new Date(b.observedAt)),
    [snapshots]
  );
  const inRange = useMemo(() => filterByRange(ordered, range), [ordered, range]);
  const series = useMemo(() => historySeries(inRange, accountsById, fx), [inRange, accountsById, fx]);
  const latest = ordered[ordered.length - 1];
  const prev = ordered[ordered.length - 2];
  const latestTotals = latest ? totalsForSnapshot(latest, accountsById, fx, accounts) : null;
  const prevTotals = prev ? totalsForSnapshot(prev, accountsById, fx, accounts) : null;
  const lkp = useMemo(() => latestKnownPosition(ordered, accounts, fx), [ordered, accounts, fx]);

  const changePct = latestTotals && prevTotals ? pctChange(latestTotals.netWorth, prevTotals.netWorth) : null;
  const coverageDiffers =
    latestTotals && prevTotals &&
    latestTotals.observedAccountIds.length !== prevTotals.observedAccountIds.length;

  const points = series.map((p) => ({
    label: format(new Date(p.observedAt), "d MMM yyyy"),
    value: showAssets ? p.assets : p.netWorth,
    key: p.snapshotId,
  }));

  const stale = useMemo(() => {
    const cutoff = Date.now() - 45 * 24 * 3600 * 1000;
    const seen = new Map<string, number>();
    for (const s of ordered) for (const e of s.entries) seen.set(e.accountId, +new Date(s.observedAt));
    return accounts.filter((a) => a.archived === 0 && (!seen.get(a.id) || seen.get(a.id)! < cutoff)).slice(0, 4);
  }, [accounts, ordered]);

  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: spacing.l, paddingBottom: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await app.refresh(); setRefreshing(false); }} />}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <Title>Plouto</Title>
          <Muted>Your money · Your progress · Your privacy</Muted>
        </View>

        {latestTotals && latest ? (
          <View style={{ marginBottom: spacing.xl, marginTop: spacing.s }}>
            <Muted style={{ marginBottom: 6 }}>Latest net worth · as of {format(new Date(latest.observedAt), "d MMM yyyy, HH:mm")}</Muted>
            <Money value={formatMoney(latestTotals.netWorth, reportingCurrency, locale)} style={{ fontSize: 34 }} />
            {prevTotals && prev ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  borderWidth: 1,
                  borderColor: toDecimal(latestTotals.netWorth).gte(toDecimal(prevTotals.netWorth)) ? theme.gain : theme.loss,
                  borderRadius: 999,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  marginTop: 10,
                }}
              >
                <Text style={{ color: toDecimal(latestTotals.netWorth).gte(toDecimal(prevTotals.netWorth)) ? theme.gain : theme.loss, fontWeight: "700", fontSize: 13, fontVariant: ["tabular-nums"] }}>
                  {formatSigned(toDecimal(latestTotals.netWorth).minus(toDecimal(prevTotals.netWorth)).toString(), reportingCurrency, locale)}
                  {changePct !== null ? ` (${Number(changePct).toFixed(1)}%)` : " (—)"} vs {format(new Date(prev.observedAt), "d MMM")}
                </Text>
              </View>
            ) : (
              <Muted style={{ marginTop: 8 }}>First snapshot — add another to track change.</Muted>
            )}
            {coverageDiffers && (
              <Muted style={{ marginTop: 8 }}>Note: snapshots cover different accounts — compare with care.</Muted>
            )}
            {latestTotals.incomplete && (
              <Muted style={{ marginTop: 8 }}>Converted total incomplete: a required exchange rate is missing.</Muted>
            )}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
              <View style={{ flex: 1 }}>
                <Muted style={{ marginBottom: 2 }}>Assets</Muted>
                <Text style={{ color: theme.text, fontWeight: "700", fontSize: 16, fontVariant: ["tabular-nums"] }}>{formatMoney(latestTotals.assets, reportingCurrency, locale)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Muted style={{ marginBottom: 2 }}>Liabilities</Muted>
                <Text style={{ color: theme.text, fontWeight: "700", fontSize: 16, fontVariant: ["tabular-nums"] }}>{formatMoney(latestTotals.liabilities, reportingCurrency, locale)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <Muted style={{ marginBottom: 2 }}>Bank & savings</Muted>
                <Text style={{ color: theme.text, fontWeight: "600", fontSize: 15 }}>{formatMoney(latestTotals.banking, reportingCurrency, locale)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Muted style={{ marginBottom: 2 }}>Investments</Muted>
                <Text style={{ color: theme.text, fontWeight: "600", fontSize: 15 }}>{formatMoney(latestTotals.investments, reportingCurrency, locale)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Muted style={{ marginBottom: 2 }}>Liquid</Muted>
                <Text style={{ color: theme.text, fontWeight: "600", fontSize: 15 }}>{formatMoney(latestTotals.liquid, reportingCurrency, locale)}</Text>
              </View>
            </View>
          </View>
        ) : (
          <Card>
            <Title style={{ fontSize: 18 }}>No snapshots yet</Title>
            <Muted style={{ marginVertical: 8 }}>Add your accounts, then record your first snapshot to start your history.</Muted>
            <Btn label="+ New snapshot" onPress={() => setSnapOpen(true)} />
          </Card>
        )}

        <View style={{ marginBottom: spacing.l }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: theme.text, fontWeight: "700" }}>{showAssets ? "Assets" : "Net worth"} history</Text>
            <Pressable onPress={() => setShowAssets((v) => !v)}>
              <Text style={{ color: theme.primary, fontWeight: "600" }}>{showAssets ? "Show net worth" : "Show assets"}</Text>
            </Pressable>
          </View>
          <LineChart
            points={points}
            key={`range-${range}`}
            dots={false}
            formatY={(v) => formatMoney(v, reportingCurrency, locale)}
            formatAxis={(v) => formatMoneyCompact(v, reportingCurrency, locale)}
            onZoomEdge={stepRange}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {RANGES.map((r) => (
              <Chip key={r.label} label={r.label} active={range === r.months} onPress={() => setRange(r.months)} />
            ))}
          </ScrollView>
          <Muted style={{ marginTop: 8 }}>Recorded snapshots only.</Muted>
        </View>

        <Card>
          <Text style={{ color: theme.text, fontWeight: "700", marginBottom: 8 }}>Latest-known position (mixed dates)</Text>
          <Muted>Combines the newest observation per account. Accounts may have been observed at different times.</Muted>
          <Money small value={formatMoney(lkp.netWorth, reportingCurrency, locale)} />
          {lkp.missingAccountIds.length > 0 && (
            <Muted style={{ marginTop: 4 }}>{lkp.missingAccountIds.length} account(s) never observed — excluded, not zero.</Muted>
          )}
        </Card>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Btn label="+ Snapshot" onPress={() => setSnapOpen(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn label="+ Account" variant="ghost" onPress={() => router.push("/(tabs)/accounts")} />
          </View>
        </View>

        <Card>
          <Text style={{ color: theme.text, fontWeight: "700", marginBottom: 8 }}>Recent activity</Text>
          {ordered.slice(-4).reverse().map((s) => {
            const t = totalsForSnapshot(s, accountsById, fx);
            return (
              <Pressable key={s.id} onPress={() => router.push(`/snapshot/${s.id}`)} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <Text style={{ color: theme.text, fontWeight: "600" }}>{s.title || format(new Date(s.observedAt), "d MMM yyyy, HH:mm")}</Text>
                <Muted>{s.entries.length} accounts · {formatMoney(t.netWorth, reportingCurrency, locale)}</Muted>
              </Pressable>
            );
          })}
          {ordered.length === 0 && <Muted>No snapshots yet.</Muted>}
        </Card>

        {stale.length > 0 && (
          <Card>
            <Text style={{ color: theme.warn, fontWeight: "700", marginBottom: 4 }}>Stale balances</Text>
            {stale.map((a) => (
              <Muted key={a.id}>• {a.name} — not updated in over 45 days. Last values are stale, not live.</Muted>
            ))}
          </Card>
        )}
      </ScrollView>
      <SheetHost open={snapOpen} onOpenChange={setSnapOpen}>
        <SnapshotForm onClose={() => setSnapOpen(false)} />
      </SheetHost>
    </View>
  );
}

