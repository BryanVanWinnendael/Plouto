import type { Account, SnapshotEntry, Snapshot, Txn, Category, ExchangeRate, SnapshotWithEntries } from "@/finance/types";

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

type Row = Record<string, unknown>;
const str = (v: unknown): string => String(v ?? "");
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));
const nul = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export function mapAccount(r: Row): Account {
  return {
    id: str(r.id), name: str(r.name), kind: r.kind === "liability" ? "liability" : "asset",
    category: str(r.category), currency: str(r.currency),
    assetClass: nul(r.asset_class), liquidity: (nul(r.liquidity) as Account["liquidity"]),
    institution: nul(r.institution), notes: nul(r.notes), icon: nul(r.icon), color: nul(r.color),
    sortOrder: num(r.sort_order), archived: num(r.archived),
    createdAt: str(r.created_at), updatedAt: str(r.updated_at),
  };
}

export function mapSnapshot(r: Row): Snapshot {
  return {
    id: str(r.id), title: nul(r.title), observedAt: str(r.observed_at),
    createdAt: str(r.created_at), updatedAt: str(r.updated_at), notes: nul(r.notes),
  };
}

export function mapEntry(r: Row): SnapshotEntry {
  return {
    id: str(r.id), snapshotId: str(r.snapshot_id), accountId: str(r.account_id),
    observedBalance: str(r.observed_balance), currency: str(r.currency),
    notes: nul(r.notes), verified: num(r.verified), createdAt: str(r.created_at), updatedAt: str(r.updated_at),
  };
}

export function mapTxn(r: Row): Txn {
  const t = str(r.type);
  return {
    id: str(r.id), type: t === "income" || t === "expense" || t === "transfer" ? t : "expense",
    amount: str(r.amount), currency: str(r.currency), date: str(r.date),
    accountId: nul(r.account_id), categoryId: nul(r.category_id),
    description: nul(r.description), notes: nul(r.notes), transferGroupId: nul(r.transfer_group_id),
    createdAt: str(r.created_at), updatedAt: str(r.updated_at),
  };
}

export function mapCategory(r: Row): Category {
  const s = str(r.scope);
  return {
    id: str(r.id), name: str(r.name),
    scope: s === "account" || s === "transaction" ? s : "both",
    kind: nul(r.kind), icon: nul(r.icon), color: nul(r.color),
  };
}

export function mapRate(r: Row): ExchangeRate {
  return {
    id: str(r.id), fromCurrency: str(r.from_currency), toCurrency: str(r.to_currency),
    rate: str(r.rate), effectiveDate: str(r.effective_date),
  };
}

export function groupSnapshots(snaps: Snapshot[], entries: SnapshotEntry[]): SnapshotWithEntries[] {
  const bySnap = new Map<string, SnapshotEntry[]>();
  for (const e of entries) {
    if (!bySnap.has(e.snapshotId)) bySnap.set(e.snapshotId, []);
    bySnap.get(e.snapshotId)!.push(e);
  }
  return snaps.map((s) => ({ ...s, entries: bySnap.get(s.id) ?? [] }));
}
