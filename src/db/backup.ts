import type { SQLiteDatabase } from "expo-sqlite";
import { getAccounts, getCategories, getEntriesFor, getRates, getSetting, getSnapshots, getTransactions } from "./repo";
import { groupSnapshots } from "./map";

export const BACKUP_VERSION = 1;

export interface BackupPayload {
  version: number;
  exportedAt: string;
  app: string;
  accounts: unknown[];
  snapshots: unknown[];
  entries: unknown[];
  transactions: unknown[];
  categories: unknown[];
  exchangeRates: unknown[];
  settings: { key: string; value: string }[];
}

export async function exportBackup(db: SQLiteDatabase): Promise<BackupPayload> {
  const [accounts, snapshots, transactions, categories, rates] = await Promise.all([
    getAccounts(db),
    getSnapshots(db, 100000),
    getTransactions(db, 100000),
    getCategories(db),
    getRates(db),
  ]);
  const entries = await getEntriesFor(db, snapshots.map((s) => s.id));
  const keys = ["reportingCurrency", "theme", "locale", "chartRange", "onboarded", "reminderEnabled", "reminderTime", "appLock"];
  const settings: { key: string; value: string }[] = [];
  for (const k of keys) {
    const v = await getSetting(db, k);
    if (v !== null) settings.push({ key: k, value: v });
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: "plouto",
    accounts: accounts as unknown[],
    snapshots: snapshots as unknown[],
    entries: entries as unknown[],
    transactions: transactions as unknown[],
    categories: categories as unknown[],
    exchangeRates: rates as unknown[],
    settings,
  };
}

export function validateBackup(data: unknown): asserts data is BackupPayload {
  if (typeof data !== "object" || data === null) throw new Error("Invalid backup file.");
  const b = data as Record<string, unknown>;
  if (b.app !== "plouto" && b.app !== "spendly") throw new Error("Not a Plouto backup.");
  if (typeof b.version !== "number" || b.version < 1 || b.version > BACKUP_VERSION)
    throw new Error(`Unsupported backup version (${String(b.version)}).`);
  for (const k of ["accounts", "snapshots", "entries", "transactions", "categories", "exchangeRates"]) {
    if (!Array.isArray(b[k])) throw new Error(`Backup is missing '${k}'.`);
  }
  void groupSnapshots;
}

export async function importBackup(db: SQLiteDatabase, backup: BackupPayload): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`DELETE FROM snapshot_entries; DELETE FROM snapshots; DELETE FROM transactions; DELETE FROM exchange_rates; DELETE FROM accounts; DELETE FROM categories; DELETE FROM app_settings;`);
    for (const a of backup.accounts as Record<string, unknown>[]) {
      await db.runAsync(
        `INSERT INTO accounts (id, name, kind, category, currency, asset_class, liquidity, institution, notes, icon, color, sort_order, archived, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        String(a.id), String(a.name), String(a.kind), String(a.category), String(a.currency),
        (a.assetClass as string) ?? null, (a.liquidity as string) ?? null, (a.institution as string) ?? null,
        (a.notes as string) ?? null, (a.icon as string) ?? null, (a.color as string) ?? null,
        Number(a.sortOrder ?? 0), Number(a.archived ?? 0), String(a.createdAt), String(a.updatedAt)
      );
    }
    for (const s of backup.snapshots as Record<string, unknown>[]) {
      await db.runAsync(`INSERT INTO snapshots (id, title, observed_at, created_at, updated_at, notes) VALUES (?,?,?,?,?,?)`,
        String(s.id), (s.title as string) ?? null, String(s.observedAt), String(s.createdAt), String(s.updatedAt), (s.notes as string) ?? null);
    }
    for (const e of backup.entries as Record<string, unknown>[]) {
      await db.runAsync(
        `INSERT INTO snapshot_entries (id, snapshot_id, account_id, observed_balance, currency, notes, verified, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
        String(e.id), String(e.snapshotId), String(e.accountId), String(e.observedBalance), String(e.currency),
        (e.notes as string) ?? null, Number(e.verified ?? 0), String(e.createdAt), String(e.updatedAt)
      );
    }
    for (const t of backup.transactions as Record<string, unknown>[]) {
      await db.runAsync(
        `INSERT INTO transactions (id, type, amount, currency, date, account_id, category_id, description, notes, transfer_group_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        String(t.id), String(t.type), String(t.amount), String(t.currency), String(t.date),
        (t.accountId as string) ?? null, (t.categoryId as string) ?? null, (t.description as string) ?? null,
        (t.notes as string) ?? null, (t.transferGroupId as string) ?? null, String(t.createdAt), String(t.updatedAt)
      );
    }
    for (const c of backup.categories as Record<string, unknown>[]) {
      await db.runAsync(`INSERT OR IGNORE INTO categories (id, name, scope, kind, icon, color) VALUES (?,?,?,?,?,?)`,
        String(c.id), String(c.name), String(c.scope ?? "both"), (c.kind as string) ?? null, (c.icon as string) ?? null, (c.color as string) ?? null);
    }
    for (const r of backup.exchangeRates as Record<string, unknown>[]) {
      await db.runAsync(`INSERT INTO exchange_rates (id, from_currency, to_currency, rate, effective_date) VALUES (?,?,?,?,?)`,
        String(r.id), String(r.fromCurrency), String(r.toCurrency), String(r.rate), String(r.effectiveDate));
    }
    for (const s of backup.settings ?? []) {
      await db.runAsync(`INSERT INTO app_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, s.key, s.value);
    }
  });
}
