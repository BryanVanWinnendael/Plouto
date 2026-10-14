import { quantize, sumDecimal, toDecimal } from "./money";
import type { Account } from "./types";
import type { ConversionContext } from "./calculations";

export interface Slice {
  key: string;
  label: string;
  value: string;
  pct: string;
  color: string;
}

const PALETTE = [
  "#2F9E63", "#4CB782", "#7FB98A", "#6FAE9E", "#C9A24B",
  "#8A6FB8", "#4E8AA8", "#E07864", "#9E9EA8", "#D16A8A",
];

export function allocationBy(
  positions: { account: Account; converted: string }[],
  group: (a: Account) => string,
  currency: string
): Slice[] {
  const groups = new Map<string, string[]>();
  for (const p of positions) {
    const k = group(p.account);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(p.converted);
  }
  const totals = [...groups.entries()].map(([key, vals]) => ({
    key,
    total: toDecimal(sumDecimal(vals)),
  }));
  const grand = totals.reduce((acc, t) => acc.plus(t.total), toDecimal(0));
  return totals.map((t, i) => ({
    key: t.key,
    label: t.key,
    value: quantize(t.total.toString(), currency),
    pct: grand.isZero() ? "0" : t.total.div(grand).times(100).toDecimalPlaces(1).toString(),
    color: PALETTE[i % PALETTE.length],
  }));
}

export function positionsForAllocation(
  byAccount: Record<string, { converted: string }>,
  accounts: Account[]
): { account: Account; converted: string }[] {
  const map = new Map(accounts.map((a) => [a.id, a]));
  const out: { account: Account; converted: string }[] = [];
  for (const [id, v] of Object.entries(byAccount)) {
    const a = map.get(id);
    if (!a || a.kind !== "asset") continue;
    out.push({ account: a, converted: v.converted });
  }
  return out;
}

export function makeFxConverter(
  reportingCurrency: string,
  rates: { fromCurrency: string; toCurrency: string; rate: string; effectiveDate: string }[]
): ConversionContext {
  return {
    reportingCurrency,
    convert: (amount, from, date) => {
      if (from.toUpperCase() === reportingCurrency.toUpperCase()) return amount;
      const target = new Date(date).getTime();
      const candidates = rates
        .filter(
          (r) =>
            r.fromCurrency.toUpperCase() === from.toUpperCase() &&
            r.toCurrency.toUpperCase() === reportingCurrency.toUpperCase() &&
            new Date(r.effectiveDate).getTime() <= target
        )
        .sort((a, b) => +new Date(b.effectiveDate) - +new Date(a.effectiveDate));
      if (candidates.length === 0) return null;
      return toDecimal(amount).times(toDecimal(candidates[0].rate)).toString();
    },
  };
}
