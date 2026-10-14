import type { SQLiteDatabase } from "expo-sqlite";
import type { Account, Category, ExchangeRate, Snapshot, SnapshotEntry, SnapshotWithEntries, Txn } from "@/finance/types";
import { mapAccount, mapCategory, mapEntry, mapRate, mapSnapshot, mapTxn, newId, nowIso, groupSnapshots } from "./map";

export async function getAccounts(db: SQLiteDatabase): Promise<Account[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM accounts ORDER BY sort_order ASC, name ASC"
  );
  return rows.map(mapAccount);
}

export async function saveAccount(db: SQLiteDatabase, a: Partial<Account> & { name: string; kind: Account["kind"]; category: string; currency: string }): Promise<Account> {
  const now = nowIso();
  if (a.id) {
    await db.runAsync(
      `UPDATE accounts SET name=?, kind=?, category=?, currency=?, asset_class=?, liquidity=?, institution=?, notes=?, icon=?, color=?, sort_order=?, archived=?, updated_at=? WHERE id=?`,
      a.name, a.kind, a.category, a.currency,
      a.assetClass ?? null, a.liquidity ?? null, a.institution ?? null, a.notes ?? null,
      a.icon ?? null, a.color ?? null, a.sortOrder ?? 0, a.archived ?? 0, now, a.id
    );
    const row = await db.getFirstAsync<Record<string, unknown>>("SELECT * FROM accounts WHERE id=?", a.id);
    return mapAccount(row!);
  }
  const id = newId("ac");
  await db.runAsync(
    `INSERT INTO accounts (id, name, kind, category, currency, asset_class, liquidity, institution, notes, icon, color, sort_order, archived, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, a.name, a.kind, a.category, a.currency.toUpperCase(),
    a.assetClass ?? null, a.liquidity ?? null, a.institution ?? null, a.notes ?? null,
    a.icon ?? null, a.color ?? null, a.sortOrder ?? 0, 0, now, now
  );
  const row = await db.getFirstAsync<Record<string, unknown>>("SELECT * FROM accounts WHERE id=?", id);
  return mapAccount(row!);
}

/** Delete account: entries preserved? Policy: block if snapshot entries exist; caller must confirm force which removes its entries. */
export async function deleteAccount(db: SQLiteDatabase, id: string, force = false): Promise<void> {
  const count = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM snapshot_entries WHERE account_id=?", id);
  if ((count?.c ?? 0) > 0 && !force) throw new Error("ACCOUNT_HAS_HISTORY");
  await db.withTransactionAsync(async () => {
    if (force) await db.runAsync("DELETE FROM snapshot_entries WHERE account_id=?", id);
    await db.runAsync("UPDATE transactions SET account_id=NULL WHERE account_id=?", id);
    await db.runAsync("DELETE FROM accounts WHERE id=?", id);
  });
}

export async function getSnapshots(db: SQLiteDatabase, limit = 500): Promise<Snapshot[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM snapshots ORDER BY observed_at DESC, created_at DESC LIMIT ?", limit
  );
  return rows.map(mapSnapshot);
}

export async function getEntriesFor(db: SQLiteDatabase, snapshotIds: string[]): Promise<SnapshotEntry[]> {
  if (snapshotIds.length === 0) return [];
  const ph = snapshotIds.map(() => "?").join(",");
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM snapshot_entries WHERE snapshot_id IN (${ph})`, snapshotIds
  );
  return rows.map(mapEntry);
}

export async function getSnapshotsWithEntries(db: SQLiteDatabase, limit = 500): Promise<SnapshotWithEntries[]> {
  const snaps = await getSnapshots(db, limit);
  const entries = await getEntriesFor(db, snaps.map((s) => s.id));
  return groupSnapshots(snaps, entries);
}

export async function getSnapshot(db: SQLiteDatabase, id: string): Promise<SnapshotWithEntries | null> {
  const s = await db.getFirstAsync<Record<string, unknown>>("SELECT * FROM snapshots WHERE id=?", id);
  if (!s) return null;
  const entries = await getEntriesFor(db, [id]);
  return { ...mapSnapshot(s), entries: entries.map((e) => e) };
}

export interface EntryInput {
  accountId: string;
  observedBalance: string;
  currency: string;
  notes?: string | null;
  verified?: boolean;
}

/** Atomic save of snapshot + entries. Absence of an account = not observed (never zero). */
export async function saveSnapshot(
  db: SQLiteDatabase,
  input: { id?: string; title?: string | null; observedAt: string; notes?: string | null; entries: EntryInput[] }
): Promise<string> {
  const now = nowIso();
  const id = input.id ?? newId("sn");
  // Duplicate detection: same observedAt minute + same account set → caller confirms; we allow save.
  await db.withTransactionAsync(async () => {
    if (input.id) {
      await db.runAsync("UPDATE snapshots SET title=?, observed_at=?, notes=?, updated_at=? WHERE id=?",
        input.title ?? null, input.observedAt, input.notes ?? null, now, id);
      await db.runAsync("DELETE FROM snapshot_entries WHERE snapshot_id=?", id);
    } else {
      await db.runAsync("INSERT INTO snapshots (id, title, observed_at, created_at, updated_at, notes) VALUES (?,?,?,?,?,?)",
        id, input.title ?? null, input.observedAt, now, now, input.notes ?? null);
    }
    for (const e of input.entries) {
      await db.runAsync(
        `INSERT INTO snapshot_entries (id, snapshot_id, account_id, observed_balance, currency, notes, verified, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
        newId("en"), id, e.accountId, e.observedBalance, e.currency.toUpperCase(),
        e.notes ?? null, e.verified ? 1 : 0, now, now
      );
    }
  });
  return id;
}

export async function deleteSnapshot(db: SQLiteDatabase, id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM snapshot_entries WHERE snapshot_id=?", id);
    await db.runAsync("DELETE FROM snapshots WHERE id=?", id);
  });
}

export async function duplicateSnapshot(db: SQLiteDatabase, id: string, observedAt: string): Promise<string> {
  const src = await getSnapshot(db, id);
  if (!src) throw new Error("NOT_FOUND");
  return saveSnapshot(db, {
    title: src.title ? `${src.title} (copy)` : null,
    observedAt,
    notes: src.notes,
    entries: src.entries.map((e) => ({
      accountId: e.accountId, observedBalance: e.observedBalance, currency: e.currency,
      notes: e.notes, verified: false,
    })),
  });
}

// Transactions
export async function getTransactions(db: SQLiteDatabase, limit = 500): Promise<Txn[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM transactions ORDER BY date DESC, created_at DESC LIMIT ?", limit
  );
  return rows.map(mapTxn);
}

export async function saveTransaction(db: SQLiteDatabase, t: Partial<Txn> & { type: Txn["type"]; amount: string; currency: string; date: string }): Promise<string> {
  const now = nowIso();
  if (t.id) {
    await db.runAsync(
      `UPDATE transactions SET type=?, amount=?, currency=?, date=?, account_id=?, category_id=?, description=?, notes=?, transfer_group_id=?, updated_at=? WHERE id=?`,
      t.type, t.amount, t.currency.toUpperCase(), t.date, t.accountId ?? null, t.categoryId ?? null,
      t.description ?? null, t.notes ?? null, t.transferGroupId ?? null, now, t.id
    );
    return t.id;
  }
  const id = newId("tx");
  await db.runAsync(
    `INSERT INTO transactions (id, type, amount, currency, date, account_id, category_id, description, notes, transfer_group_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, t.type, t.amount, t.currency.toUpperCase(), t.date, t.accountId ?? null, t.categoryId ?? null,
    t.description ?? null, t.notes ?? null, t.transferGroupId ?? null, now, now
  );
  return id;
}

export async function saveTransfer(
  db: SQLiteDatabase,
  input: { amount: string; currency: string; date: string; fromAccountId: string; toAccountId: string; description?: string | null }
): Promise<string> {
  const group = newId("tg");
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    for (const [accountId, type] of [[input.fromAccountId, "transfer"], [input.toAccountId, "transfer"]] as const) {
      await db.runAsync(
        `INSERT INTO transactions (id, type, amount, currency, date, account_id, category_id, description, notes, transfer_group_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        newId("tx"), type, input.amount, input.currency.toUpperCase(), input.date, accountId, null,
        input.description ?? "Transfer", null, group, now, now
      );
    }
  });
  return group;
}

export async function deleteTransaction(db: SQLiteDatabase, id: string): Promise<void> {
  const row = await db.getFirstAsync<Record<string, unknown>>("SELECT * FROM transactions WHERE id=?", id);
  if (!row) return;
  const t = mapTxn(row);
  if (t.transferGroupId) {
    await db.runAsync("DELETE FROM transactions WHERE transfer_group_id=?", t.transferGroupId);
  } else {
    await db.runAsync("DELETE FROM transactions WHERE id=?", id);
  }
}

export async function getCategories(db: SQLiteDatabase): Promise<Category[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>("SELECT * FROM categories ORDER BY name ASC");
  return rows.map(mapCategory);
}

export async function getRates(db: SQLiteDatabase): Promise<ExchangeRate[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>("SELECT * FROM exchange_rates ORDER BY effective_date DESC");
  return rows.map(mapRate);
}

export async function saveRate(db: SQLiteDatabase, r: { fromCurrency: string; toCurrency: string; rate: string; effectiveDate: string }): Promise<void> {
  await db.runAsync("INSERT INTO exchange_rates (id, from_currency, to_currency, rate, effective_date) VALUES (?,?,?,?,?)",
    newId("fx"), r.fromCurrency.toUpperCase(), r.toCurrency.toUpperCase(), r.rate, r.effectiveDate);
}

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key=?", key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync("INSERT INTO app_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, value);
}

export async function wipeAll(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`DELETE FROM snapshot_entries; DELETE FROM snapshots; DELETE FROM transactions; DELETE FROM exchange_rates; DELETE FROM accounts; DELETE FROM app_settings WHERE key NOT LIKE 'keep_%';`);
  });
}
