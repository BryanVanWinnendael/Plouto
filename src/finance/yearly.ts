import type { SnapshotWithEntries, Account } from "./types";
import { totalsForSnapshot, type ConversionContext } from "./calculations";
import { toDecimal } from "./money";

export interface YearSummary {
  year: number;
  firstSnapshotId: string | null;
  firstObservedAt: string | null;
  lastSnapshotId: string | null;
  lastObservedAt: string | null;
  startNetWorth: string | null;
  endNetWorth: string | null;
  change: string | null;
  pct: string | null;
  snapshotCount: number;
  isCurrentYear: boolean;
  limited: boolean; // true when coverage is sparse
}

export function yearlySummaries(
  snapshots: SnapshotWithEntries[],
  accountsById: Map<string, Account>,
  fx: ConversionContext,
  now = new Date()
): YearSummary[] {
  const byYear = new Map<number, SnapshotWithEntries[]>();
  for (const s of snapshots) {
    const y = new Date(s.observedAt).getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(s);
  }
  const years = [...byYear.keys()].sort();
  return years.map((year) => {
    const list = byYear.get(year)!.sort((a, b) => +new Date(a.observedAt) - +new Date(b.observedAt));
    const first = list[0];
    const last = list[list.length - 1];
    const tFirst = totalsForSnapshot(first, accountsById, fx);
    const tLast = totalsForSnapshot(last, accountsById, fx);
    const change =
      list.length >= 1
        ? toDecimal(tLast.netWorth).minus(toDecimal(tFirst.netWorth)).toString()
        : null;
    const base = toDecimal(tFirst.netWorth);
    const pct =
      list.length >= 2 && !base.isZero()
        ? toDecimal(tLast.netWorth).minus(base).div(base.abs()).times(100).toString()
        : null;
    const limited = list.length < 2;
    return {
      year,
      firstSnapshotId: first.id,
      firstObservedAt: first.observedAt,
      lastSnapshotId: last.id,
      lastObservedAt: last.observedAt,
      startNetWorth: tFirst.netWorth,
      endNetWorth: tLast.netWorth,
      change,
      pct,
      snapshotCount: list.length,
      isCurrentYear: year === now.getFullYear(),
      limited,
    };
  });
}
