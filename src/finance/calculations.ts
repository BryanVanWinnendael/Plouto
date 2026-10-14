import { pctChange, quantize, subDecimal, sumDecimal, toDecimal } from "./money";
import {
  BANKING_CATEGORIES,
  INVESTMENT_CATEGORIES,
  type Account,
  type Snapshot,
  type SnapshotEntry,
  type SnapshotWithEntries,
} from "./types";

export interface PositionTotals {
  assets: string;
  liabilities: string;
  netWorth: string;
  banking: string;
  investments: string;
  liquid: string;
  currency: string;
  /** Account ids observed in this position (coverage). */
  observedAccountIds: string[];
  /** Account ids missing vs the supplied account universe. */
  missingAccountIds: string[];
  incomplete: boolean;
}

export interface ConversionContext {
  reportingCurrency: string;
  /** Convert amount in `from` currency on `date` to reporting currency. Returns null if no rate. */
  convert: (amount: string, from: string, date: string) => string | null;
}

/** Identity conversion (single currency, no FX). */
export function identityConversion(reportingCurrency: string): ConversionContext {
  return {
    reportingCurrency,
    convert: (amount, from) => {
      if (from.toUpperCase() === reportingCurrency.toUpperCase()) return amount;
      return null;
    },
  };
}

function entryValueInReporting(
  entry: SnapshotEntry,
  fx: ConversionContext
): string | null {
  const converted = fx.convert(entry.observedBalance, entry.currency, new Date().toISOString());
  return converted;
}

export function totalsForSnapshot(
  snapshot: SnapshotWithEntries,
  accountsById: Map<string, Account>,
  fx: ConversionContext,
  universe?: Account[]
): PositionTotals {
  const assets: string[] = [];
  const liabilities: string[] = [];
  const banking: string[] = [];
  const investments: string[] = [];
  const liquid: string[] = [];
  const observed: string[] = [];
  let incomplete = false;

  for (const e of snapshot.entries) {
    const acct = accountsById.get(e.accountId);
    if (!acct || acct.archived === 1) continue;
    const rateDate = snapshot.observedAt;
    const converted = fx.convert(e.observedBalance, e.currency, rateDate);
    if (converted === null) {
      incomplete = true;
      continue;
    }
    observed.push(e.accountId);
    if (acct.kind === "asset") assets.push(converted);
    else liabilities.push(converted);
    if (BANKING_CATEGORIES.includes(acct.category)) banking.push(converted);
    if (INVESTMENT_CATEGORIES.includes(acct.category)) investments.push(converted);
    if (acct.liquidity === "liquid") liquid.push(converted);
  }

  const missingAccountIds = universe
    ? universe.filter((a) => a.archived === 0 && !observed.includes(a.id)).map((a) => a.id)
    : [];

  const assetsS = quantize(sumDecimal(assets), fx.reportingCurrency);
  const liabS = quantize(sumDecimal(liabilities), fx.reportingCurrency);
  return {
    assets: assetsS,
    liabilities: liabS,
    netWorth: quantize(subDecimal(assetsS, liabS), fx.reportingCurrency),
    banking: quantize(sumDecimal(banking), fx.reportingCurrency),
    investments: quantize(sumDecimal(investments), fx.reportingCurrency),
    liquid: quantize(sumDecimal(liquid), fx.reportingCurrency),
    currency: fx.reportingCurrency,
    observedAccountIds: observed,
    missingAccountIds,
    incomplete,
  };
}

export interface LatestKnownPosition extends PositionTotals {
  /** accountId -> { balance (converted), observedAt, original } */
  byAccount: Record<string, { converted: string; observedAt: string; original: string; currency: string }>;
}

/**
 * Latest-known-position: newest observation per account across snapshots.
 * Explicitly labeled with mixed observation dates — never a verified balance.
 */
export function latestKnownPosition(
  snapshots: SnapshotWithEntries[],
  accounts: Account[],
  fx: ConversionContext
): LatestKnownPosition {
  const active = accounts.filter((a) => a.archived === 0);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const newest = new Map<string, { entry: SnapshotEntry; observedAt: string }>();
  const ordered = [...snapshots].sort((a, b) => +new Date(a.observedAt) - +new Date(b.observedAt));
  for (const s of ordered) {
    for (const e of s.entries) {
      const cur = newest.get(e.accountId);
      if (!cur || +new Date(s.observedAt) >= +new Date(cur.observedAt)) {
        newest.set(e.accountId, { entry: e, observedAt: s.observedAt });
      }
    }
  }
  const assets: string[] = [];
  const liab: string[] = [];
  const banking: string[] = [];
  const inv: string[] = [];
  const liq: string[] = [];
  const byAccount: LatestKnownPosition["byAccount"] = {};
  const observed: string[] = [];
  let incomplete = false;
  for (const a of active) {
    const hit = newest.get(a.id);
    if (!hit) continue;
    const converted = fx.convert(hit.entry.observedBalance, hit.entry.currency, hit.observedAt);
    if (converted === null) {
      incomplete = true;
      continue;
    }
    observed.push(a.id);
    byAccount[a.id] = {
      converted,
      observedAt: hit.observedAt,
      original: hit.entry.observedBalance,
      currency: hit.entry.currency,
    };
    if (a.kind === "asset") assets.push(converted);
    else liab.push(converted);
    if (BANKING_CATEGORIES.includes(a.category)) banking.push(converted);
    if (INVESTMENT_CATEGORIES.includes(a.category)) inv.push(converted);
    if (a.liquidity === "liquid") liq.push(converted);
  }
  const assetsS = quantize(sumDecimal(assets), fx.reportingCurrency);
  const liabS = quantize(sumDecimal(liab), fx.reportingCurrency);
  void byId;
  void entryValueInReporting;
  return {
    assets: assetsS,
    liabilities: liabS,
    netWorth: quantize(subDecimal(assetsS, liabS), fx.reportingCurrency),
    banking: quantize(sumDecimal(banking), fx.reportingCurrency),
    investments: quantize(sumDecimal(inv), fx.reportingCurrency),
    liquid: quantize(sumDecimal(liq), fx.reportingCurrency),
    currency: fx.reportingCurrency,
    observedAccountIds: observed,
    missingAccountIds: active.filter((a) => !observed.includes(a.id)).map((a) => a.id),
    incomplete,
    byAccount,
  };
}

export interface ChangeSummary {
  absolute: string;
  pct: string | null;
  current: string;
  baseline: string;
}

export function changeSummary(current: string | number, baseline: string | number, currency: string): ChangeSummary {
  const abs = quantize(subDecimal(String(current), String(baseline)), currency);
  return {
    absolute: abs,
    pct: pctChange(String(current), String(baseline)),
    current: String(current),
    baseline: String(baseline),
  };
}

export function isMeaningfulPct(pct: string | null): boolean {
  if (pct === null) return false;
  return toDecimal(pct).isFinite();
}

/** Build a historical series of net worth points from snapshots (recorded only, no fabrication). */
export function historySeries(
  snapshots: SnapshotWithEntries[],
  accountsById: Map<string, Account>,
  fx: ConversionContext
): { snapshotId: string; observedAt: string; netWorth: string; assets: string; liabilities: string; incomplete: boolean }[] {
  return [...snapshots]
    .sort((a, b) => +new Date(a.observedAt) - +new Date(b.observedAt))
    .map((s) => {
      const t = totalsForSnapshot(s, accountsById, fx);
      return {
        snapshotId: s.id,
        observedAt: s.observedAt,
        netWorth: t.netWorth,
        assets: t.assets,
        liabilities: t.liabilities,
        incomplete: t.incomplete,
      };
    });
}

export function highestLowest(
  series: { netWorth: string }[]
): { highest: string | null; lowest: string | null } {
  if (series.length === 0) return { highest: null, lowest: null };
  let hi = toDecimal(series[0].netWorth);
  let lo = toDecimal(series[0].netWorth);
  for (const p of series) {
    const d = toDecimal(p.netWorth);
    if (d.gt(hi)) hi = d;
    if (d.lt(lo)) lo = d;
  }
  return { highest: hi.toString(), lowest: lo.toString() };
}

/** Filter snapshots to a rolling window. `months` null = all time. */
export function filterByRange<T extends { observedAt: string }>(items: T[], months: number | null, now = new Date()): T[] {
  if (months === null) return items;
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return items.filter((i) => +new Date(i.observedAt) >= +cutoff);
}
