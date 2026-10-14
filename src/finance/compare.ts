import { quantize, sumDecimal, toDecimal } from "./money";
import type { Account, SnapshotWithEntries } from "./types";
import { totalsForSnapshot } from "./calculations";
import type { ConversionContext } from "./calculations";

export interface CompareResult {
  aTotals: ReturnType<typeof totalsForSnapshot>;
  bTotals: ReturnType<typeof totalsForSnapshot>;
  netWorthChange: string;
  netWorthPct: string | null;
  /** Per-account rows. Missing in one side => other side null (never zero-filled silently). */
  rows: {
    accountId: string;
    name: string;
    a: string | null;
    b: string | null;
    change: string | null;
    pct: string | null;
    inBoth: boolean;
  }[];
  onlyInA: string[];
  onlyInB: string[];
}

export function compareSnapshots(
  a: SnapshotWithEntries,
  b: SnapshotWithEntries,
  accountsById: Map<string, Account>,
  fx: ConversionContext,
  sort: "increase" | "decrease" | "name" = "name"
): CompareResult {
  const aTotals = totalsForSnapshot(a, accountsById, fx);
  const bTotals = totalsForSnapshot(b, accountsById, fx);

  const aMap = new Map(a.entries.map((e) => [e.accountId, e]));
  const bMap = new Map(b.entries.map((e) => [e.accountId, e]));
  const ids = new Set([...aMap.keys(), ...bMap.keys()]);

  const rows: CompareResult["rows"] = [];
  for (const id of ids) {
    const acct = accountsById.get(id);
    if (!acct) continue;
    const ea = aMap.get(id);
    const eb = bMap.get(id);
    const ca = ea ? fx.convert(ea.observedBalance, ea.currency, a.observedAt) : null;
    const cb = eb ? fx.convert(eb.observedBalance, eb.currency, b.observedAt) : null;
    const inBoth = ca !== null && cb !== null;
    let change: string | null = null;
    let pct: string | null = null;
    if (inBoth) {
      change = quantize(toDecimal(cb!).minus(toDecimal(ca!)).toString(), fx.reportingCurrency);
      const base = toDecimal(ca!);
      pct = base.isZero() ? null : toDecimal(cb!).minus(base).div(base.abs()).times(100).toString();
    }
    rows.push({ accountId: id, name: acct.name, a: ca, b: cb, change, pct, inBoth });
  }

  rows.sort((x, y) => {
    if (sort === "name") return x.name.localeCompare(y.name);
    const vx = x.change === null ? -Infinity : Number(toDecimal(x.change).toString());
    const vy = y.change === null ? -Infinity : Number(toDecimal(y.change).toString());
    return sort === "increase" ? vy - vx : vx - vy;
  });

  const onlyInA = rows.filter((r) => r.a !== null && r.b === null).map((r) => r.accountId);
  const onlyInB = rows.filter((r) => r.b !== null && r.a === null).map((r) => r.accountId);

  // Common-coverage net worth change: only accounts observed in both.
  const commonIds = rows.filter((r) => r.inBoth).map((r) => r.accountId);
  const sumFor = (s: SnapshotWithEntries, keep: Set<string>) => {
    const vals: string[] = [];
    for (const e of s.entries) {
      if (!keep.has(e.accountId)) continue;
      const acct = accountsById.get(e.accountId);
      if (!acct) continue;
      const sign = acct.kind === "liability" ? -1 : 1;
      const c = fx.convert(e.observedBalance, e.currency, s.observedAt);
      if (c === null) continue;
      vals.push(sign === 1 ? c : toDecimal(c).neg().toString());
    }
    return quantize(sumDecimal(vals), fx.reportingCurrency);
  };
  const keep = new Set(commonIds);
  const commonA = sumFor(a, keep);
  const commonB = sumFor(b, keep);
  void commonA;
  void commonB;

  const nwChange = quantize(toDecimal(bTotals.netWorth).minus(toDecimal(aTotals.netWorth)).toString(), fx.reportingCurrency);
  const base = toDecimal(aTotals.netWorth);
  const nwPct = base.isZero() ? null : toDecimal(bTotals.netWorth).minus(base).div(base.abs()).times(100).toString();

  return { aTotals, bTotals, netWorthChange: nwChange, netWorthPct: nwPct, rows, onlyInA, onlyInB };
}
