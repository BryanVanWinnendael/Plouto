import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { format } from "date-fns";
import { useApp } from "@/store/AppContext";
import { useTheme } from "@/theme/ThemeContext";
import { spacing } from "@/theme/tokens";
import { Btn, Card, Chip, Muted, Title } from "@/components/ui";
import { DonutChart, LineChart } from "@/components/charts";
import { highestLowest, historySeries, latestKnownPosition, totalsForSnapshot } from "@/finance/calculations";
import { allocationBy, positionsForAllocation } from "@/finance/allocation";
import { yearlySummaries } from "@/finance/yearly";
import { formatMoney, formatMoneyCompact, sumDecimal } from "@/finance/money";

export default function History() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { snapshots, accounts, accountsById, fx, reportingCurrency, locale, refresh } = useApp();
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [group, setGroup] = useState<"category" | "account" | "class" | "liquidity">("category");
  const [allocSnapId, setAllocSnapId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const ordered = useMemo(
    () => [...snapshots].sort((a, b) => +new Date(a.observedAt) - +new Date(b.observedAt)),
    [snapshots]
  );
  const series = useMemo(() => historySeries(ordered, accountsById, fx), [ordered, accountsById, fx]);
  const { highest, lowest } = useMemo(() => highestLowest(series), [series]);

  const lkp = useMemo(() => latestKnownPosition(ordered, accounts, fx), [ordered, accounts, fx]);
  const allocSnap = allocSnapId ? ordered.find((s) => s.id === allocSnapId) : null;

  const positions = useMemo(() => {
    if (allocSnap) {
      return allocSnap.entries
        .map((e) => ({
          account: accountsById.get(e.accountId)!,
          converted: fx.convert(e.observedBalance, e.currency, allocSnap.observedAt),
        }))
        .filter((x) => x.account && x.converted !== null && x.account.kind === "asset")
        .map((x) => ({ account: x.account!, converted: x.converted! }));
    }
    return positionsForAllocation(lkp.byAccount, accounts);
  }, [allocSnap, accountsById, fx, lkp, accounts]);

  const groupFn = (a: (typeof positions)[number]["account"]) => {
    if (group === "category") return a.category;
    if (group === "account") return a.name;
    if (group === "class") return a.assetClass ?? "Unclassified";
    return a.liquidity ?? "Unclassified";
  };

  const slices = useMemo(
    () =>
      allocationBy(positions, groupFn, reportingCurrency).map((s) => ({
        ...s,
        value: formatMoney(s.value, reportingCurrency, locale),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positions, group, reportingCurrency]
  );

  const years = useMemo(() => yearlySummaries(ordered, accountsById, fx), [ordered, accountsById, fx]);

  const cats = useMemo(() => {
    const s = new Set<string>();
    ordered.forEach((sn) => sn.entries.forEach((e) => {
      const a = accountsById.get(e.accountId);
      if (a) s.add(a.category);
    }));
    return [...s];
  }, [ordered, accountsById]);

  const filtered = useMemo(
    () => [...ordered].reverse().filter((s) => !catFilter || s.entries.some((e) => accountsById.get(e.accountId)?.category === catFilter)),
    [ordered, catFilter, accountsById]
  );
  const visible = expanded ? filtered : filtered.slice(0, PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return next.slice(-2);
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.l, paddingBottom: selected.length === 2 ? insets.bottom + 170 : 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
          />
        }
      >
        <Title>History</Title>
        <Muted>Actual recorded snapshots — sparse points are shown honestly.</Muted>

        <Card>
          <LineChart
            points={series.map((p) => ({ label: format(new Date(p.observedAt), "d MMM yy"), value: p.netWorth, key: p.snapshotId }))}
            formatY={(v) => formatMoney(v, reportingCurrency, locale)}
            formatAxis={(v) => formatMoneyCompact(v, reportingCurrency, locale)}
            onSelect={(i) => { const p = series[i]; if (p) router.push(`/snapshot/${p.snapshotId}`); }}
          />
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Muted>Highest recorded</Muted>
              <Text style={{ color: theme.gain, fontWeight: "700" }}>{highest ? formatMoney(highest, reportingCurrency, locale) : "—"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Muted>Lowest recorded</Muted>
              <Text style={{ color: theme.loss, fontWeight: "700" }}>{lowest ? formatMoney(lowest, reportingCurrency, locale) : "—"}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={{ color: theme.text, fontWeight: "700", marginBottom: 8 }}>Allocation</Text>
          <Muted>Account-level allocation (not security-level) unless you classify holdings. Denominator: total assets.</Muted>
          <View style={{ flexDirection: "row", marginVertical: 8 }}>
            {(["category", "account", "class", "liquidity"] as const).map((g) => (
              <Chip key={g} label={g} active={group === g} onPress={() => setGroup(g)} />
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <Chip label="Latest-known" active={!allocSnapId} onPress={() => setAllocSnapId(null)} />
            {[...ordered].reverse().slice(0, 6).map((s) => (
              <Chip key={s.id} label={s.observedAt.slice(0, 10)} active={allocSnapId === s.id} onPress={() => setAllocSnapId(s.id)} />
            ))}
          </ScrollView>
          {slices.length > 0 ? (
            <DonutChart
              slices={slices}
              centerValue={formatMoney(sumDecimal(positions.map((p) => p.converted)), reportingCurrency, locale)}
              centerLabel="Total assets"
            />
          ) : (
            <Muted>No asset observations yet.</Muted>
          )}
        </Card>

        <Card>
          <Text style={{ color: theme.text, fontWeight: "700", marginBottom: 8 }}>Yearly breakdown</Text>
          {years.map((y) => (
            <View key={y.year} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.text, fontWeight: "700" }}>{y.year}{y.isCurrentYear ? " (YTD)" : ""}</Text>
                <Text style={{ color: theme.text, fontVariant: ["tabular-nums"] }}>
                  {y.change !== null ? formatMoney(y.change, reportingCurrency, locale) : "—"}
                </Text>
              </View>
              <Muted>
                {y.firstObservedAt?.slice(0, 10)} → {y.lastObservedAt?.slice(0, 10)} · {y.snapshotCount} snapshot(s)
                {y.limited ? " · sparse — earliest/latest shown, not true Jan/Dec balances" : ""}
              </Muted>
            </View>
          ))}
          {years.length === 0 && <Muted>No yearly data yet.</Muted>}
        </Card>

        {cats.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <Chip label="All" active={catFilter === null} onPress={() => setCatFilter(null)} />
            {cats.map((c) => (
              <Chip key={c} label={c} active={catFilter === c} onPress={() => setCatFilter(c)} />
            ))}
          </ScrollView>
        )}

        {selected.length > 0 && selected.length < 2 && (
          <Muted style={{ marginVertical: 6 }}>Selected {selected.length}/2 — use the checkboxes to pick two.</Muted>
        )}

        <Text style={{ color: theme.text, fontWeight: "700", marginBottom: 8 }}>Check-ins</Text>
        {visible.map((s) => {
          const t = totalsForSnapshot(s, accountsById, fx);
          const isSel = selected.includes(s.id);
          return (
            <View
              key={s.id}
              style={{
                backgroundColor: isSel ? theme.primarySoft : theme.surface,
                borderColor: isSel ? theme.primary : theme.border,
                borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8,
                flexDirection: "row", alignItems: "center",
              }}
            >
              <Pressable style={{ flex: 1 }} onPress={() => router.push(`/snapshot/${s.id}`)}>
                <Text style={{ color: theme.text, fontWeight: "700" }}>{s.title || format(new Date(s.observedAt), "d MMM yyyy, HH:mm")}</Text>
                <Muted>{s.entries.length} accounts observed · entered {format(new Date(s.createdAt), "d MMM yyyy")}</Muted>
                <Text style={{ color: theme.text, fontWeight: "700", fontVariant: ["tabular-nums"], marginTop: 2 }}>
                  {formatMoney(t.netWorth, reportingCurrency, locale)}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSel }}
                accessibilityLabel={isSel ? `Deselect ${s.title || "snapshot"} for compare` : `Select ${s.title || "snapshot"} for compare`}
                hitSlop={12}
                onPress={() => toggleSelect(s.id)}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  alignItems: "center", justifyContent: "center",
                  borderWidth: 2, marginLeft: 8,
                  borderColor: isSel ? theme.primary : theme.border,
                  backgroundColor: isSel ? theme.primary : "transparent",
                }}
              >
                {isSel && <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>✓</Text>}
              </Pressable>
            </View>
          );
        })}
        {!expanded && filtered.length > PAGE_SIZE && (
          <Btn label={`Show all ${filtered.length} check-ins`} variant="ghost" onPress={() => setExpanded(true)} />
        )}
        {expanded && filtered.length > PAGE_SIZE && (
          <Btn label="Show less" variant="ghost" onPress={() => setExpanded(false)} />
        )}
        {ordered.length === 0 && (
          <Card>
            <Muted>No snapshots yet.</Muted>
            <Btn label="Create first snapshot" onPress={() => router.push("/snapshot/new")} />
          </Card>
        )}
      </ScrollView>
      {selected.length === 2 && (
        <View
          style={{
            position: "absolute", left: 16, right: 16, bottom: insets.bottom + 64,
            borderRadius: 20, overflow: "hidden",
            borderWidth: 1, borderColor: theme.border,
          }}
        >
          <BlurView
            intensity={75}
            tint={isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"}
            style={StyleSheet.absoluteFill}
          />
          <View style={{ padding: 12 }}>
            <Btn label="Compare selected" onPress={() => router.push(`/snapshot/compare?a=${selected[0]}&b=${selected[1]}`)} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const PAGE_SIZE = 10;
