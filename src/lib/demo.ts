import type { SQLiteDatabase } from "expo-sqlite";
import { getAccounts, saveAccount, saveSnapshot } from "@/db/repo";
import { nowIso } from "@/db/map";

/** Clearly-labeled demo data; removable by deleting its snapshots/accounts. */
export async function seedDemo(db: SQLiteDatabase, currency: string): Promise<void> {
  const now = new Date();
  const mk = async (name: string, kind: "asset" | "liability", category: string, liquidity: "liquid" | "illiquid" = "liquid") => {
    const a = await saveAccount(db, { name: `[Demo] ${name}`, kind, category, currency, liquidity, sortOrder: 0 });
    return a;
  };
  const checking = await mk("Checking", "asset", "Checking");
  const savings = await mk("Savings", "asset", "Savings");
  const etf = await mk("ETF Portfolio", "asset", "Stocks & ETFs", "illiquid");
  const card = await mk("Credit card", "liability", "Credit card");
  const existing = await getAccounts(db);
  void existing;

  const monthsAgo = (n: number) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - n);
    return d.toISOString();
  };
  const balances: [number, string, string, string, string][] = [
    [5, "3200", "12000", "18000", "1400"],
    [4, "3400", "12200", "18400", "1200"],
    [3, "3100", "12500", "17900", "1600"],
    [2, "3600", "12800", "19200", "900"],
    [1, "3900", "13000", "20100", "1100"],
    [0, "4100", "13200", "21000", "800"],
  ];
  for (const [m, c, s, e, cc] of balances) {
    const at = m === 0 ? nowIso() : monthsAgo(m);
    await saveSnapshot(db, {
      title: "[Demo] Monthly check-in",
      observedAt: at,
      notes: "Demo data — delete these snapshots to remove the demo.",
      entries: [
        { accountId: checking.id, observedBalance: c, currency, verified: true },
        { accountId: savings.id, observedBalance: s, currency, verified: true },
        { accountId: etf.id, observedBalance: e, currency, verified: true },
        { accountId: card.id, observedBalance: cc, currency, verified: true },
      ],
    });
  }
}
