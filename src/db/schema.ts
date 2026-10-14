import type { SQLiteDatabase } from "expo-sqlite";

export const DATABASE_NAME = "plouto.db";
export const SCHEMA_VERSION = 3;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let v: number = row?.user_version ?? 0;

  if (v < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('asset','liability')),
        category TEXT NOT NULL,
        currency TEXT NOT NULL,
        asset_class TEXT,
        liquidity TEXT,
        institution TEXT,
        notes TEXT,
        icon TEXT,
        color TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS snapshots (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT,
        observed_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        notes TEXT
      );
      CREATE TABLE IF NOT EXISTS snapshot_entries (
        id TEXT PRIMARY KEY NOT NULL,
        snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        observed_balance TEXT NOT NULL,
        currency TEXT NOT NULL,
        notes TEXT,
        verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(snapshot_id, account_id)
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
        amount TEXT NOT NULL,
        currency TEXT NOT NULL,
        date TEXT NOT NULL,
        account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        category_id TEXT,
        description TEXT,
        notes TEXT,
        transfer_group_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'both',
        kind TEXT,
        icon TEXT,
        color TEXT,
        UNIQUE(name, scope)
      );
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id TEXT PRIMARY KEY NOT NULL,
        from_currency TEXT NOT NULL,
        to_currency TEXT NOT NULL,
        rate TEXT NOT NULL,
        effective_date TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_entries_snapshot ON snapshot_entries(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_entries_account ON snapshot_entries(account_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_observed ON snapshots(observed_at);
      CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_rates_pair ON exchange_rates(from_currency, to_currency, effective_date);
    `);
    v = 1;
  }
  if (v < 2) {
    await db.execAsync(`
      ALTER TABLE accounts ADD COLUMN sort_order_new INTEGER NOT NULL DEFAULT 0;
    `).catch(() => {});
    v = 2;
  }
  if (v < 3) {
    // Ensure transfer_group index for paired transfers
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_tx_transfer ON transactions(transfer_group_id);`);
    v = 3;
  }
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

export async function seedDefaultCategories(db: SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM categories");
  if ((existing?.c ?? 0) > 0) return;
  const now = new Date().toISOString();
  const mk = (id: string, name: string, scope: string, kind: string | null) =>
    db.runAsync("INSERT OR IGNORE INTO categories (id, name, scope, kind) VALUES (?,?,?,?)", id, name, scope, kind);
  const accountCats: [string, string][] = [
    ["Checking", "asset"], ["Savings", "asset"], ["Cash", "asset"], ["Emergency fund", "asset"],
    ["Investments", "asset"], ["Stocks & ETFs", "asset"], ["Bonds", "asset"], ["Retirement", "asset"],
    ["Crypto", "asset"], ["Real estate", "asset"], ["Precious metals", "asset"], ["Other assets", "asset"],
    ["Credit card", "liability"], ["Loans", "liability"], ["Mortgage", "liability"], ["Other liabilities", "liability"],
  ];
  for (const [n, k] of accountCats) await mk(`ac-${n}`, n, "account", k);
  void now;
  const txCats: [string, string][] = [
    ["Salary", "income"], ["Freelance", "income"], ["Interest", "income"], ["Other income", "income"],
    ["Housing", "expense"], ["Food", "expense"], ["Transport", "expense"], ["Health", "expense"],
    ["Entertainment", "expense"], ["Shopping", "expense"], ["Utilities", "expense"], ["Other", "expense"],
  ];
  for (const [n, k] of txCats) await mk(`tx-${n}`, n, "transaction", k);
}
