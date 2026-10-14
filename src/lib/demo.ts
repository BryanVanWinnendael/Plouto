import type { SQLiteDatabase } from "expo-sqlite";
import { getAccounts, saveAccount, saveSnapshot } from "@/db/repo";
import { nowIso } from "@/db/map";

/** Deterministic PRNG so demo data is stable across seeds. */
function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round2 = (n: number) => (Math.round(n * 100) / 100).toString();

/**
 * Rich, clearly-labeled demo history: 6 accounts, 30 monthly snapshots over
 * ~2.5 years with growth trends, a market dip + recovery, and natural noise —
 * so charts, allocation, and yearly breakdowns have something to show.
 * Skips seeding if demo accounts already exist (never duplicates, never
 * touches real user data).
 */
export async function seedDemo(db: SQLiteDatabase, currency: string): Promise<void> {
  const existing = await getAccounts(db);
  if (existing.some((a) => a.name.startsWith("[Demo]"))) return;

  const rand = mulberry(20240613);
  const noise = (amt: number) => (rand() - 0.5) * 2 * amt;

  const mk = async (
    name: string, kind: "asset" | "liability", category: string,
    liquidity: "liquid" | "semi_liquid" | "illiquid" = "liquid"
  ) => saveAccount(db, { name: `[Demo] ${name}`, kind, category, currency, liquidity, sortOrder: 0 });

  const checking = await mk("Checking", "asset", "Checking", "liquid");
  const savings = await mk("Savings", "asset", "Savings", "liquid");
  const etf = await mk("ETF Portfolio", "asset", "Stocks & ETFs", "illiquid");
  const crypto = await mk("Crypto", "asset", "Crypto", "illiquid");
  const retirement = await mk("Retirement", "asset", "Retirement", "illiquid");
  const card = await mk("Credit card", "liability", "Credit card");

  const MONTHS = 30;
  for (let m = MONTHS - 1; m >= 0; m--) {
    const elapsed = MONTHS - 1 - m; // 0 = oldest
    const d = new Date();
    d.setMonth(d.getMonth() - m);
    d.setDate(3 + Math.floor(rand() * 22));
    d.setHours(9 + Math.floor(rand() * 10), Math.floor(rand() * 60), 0, 0);
    const observedAt = m === 0 ? nowIso() : d.toISOString();

    const checkingBal = round2(2600 + elapsed * 65 + noise(420));
    const savingsBal = round2(8200 + elapsed * 460 + noise(160));
    // Market dip ~12–9 months ago, then recovery
    const inDip = m >= 9 && m <= 12;
    const etfBal = round2((15200 + elapsed * 680) * (inDip ? 0.78 : 1) + noise(520));
    const cryptoBal = round2(Math.max(300, 2600 + 3400 * Math.abs(Math.sin(elapsed * 0.55)) + noise(900)));
    const retirementBal = round2(10200 + elapsed * 560 + noise(140));
    const cardBal = round2(Math.max(120, 700 + noise(650)));

    const notes = inDip && m === 12 ? "Market dip — stayed invested." : null;

    await saveSnapshot(db, {
      title: "[Demo] Monthly check-in",
      observedAt,
      notes,
      entries: [
        { accountId: checking.id, observedBalance: checkingBal, currency, verified: false },
        { accountId: savings.id, observedBalance: savingsBal, currency, verified: false },
        { accountId: etf.id, observedBalance: etfBal, currency, verified: false },
        { accountId: crypto.id, observedBalance: cryptoBal, currency, verified: false },
        { accountId: retirement.id, observedBalance: retirementBal, currency, verified: false },
        { accountId: card.id, observedBalance: cardBal, currency, verified: false },
      ],
    });
  }
}
