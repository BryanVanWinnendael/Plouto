export type AccountKind = "asset" | "liability";
export type Liquidity = "liquid" | "semi_liquid" | "illiquid" | null;
export type TxType = "income" | "expense" | "transfer";

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  category: string;
  currency: string;
  assetClass: string | null;
  liquidity: Exclude<Liquidity, null> | null;
  institution: string | null;
  notes: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  archived: number; // 0/1
  createdAt: string;
  updatedAt: string;
}

export interface Snapshot {
  id: string;
  title: string | null;
  observedAt: string; // ISO
  createdAt: string;
  updatedAt: string;
  notes: string | null;
}

export interface SnapshotEntry {
  id: string;
  snapshotId: string;
  accountId: string;
  observedBalance: string; // decimal string, positive outstanding amount
  currency: string;
  notes: string | null;
  verified: number; // 0/1
  createdAt: string;
  updatedAt: string;
}

export interface Txn {
  id: string;
  type: TxType;
  amount: string; // decimal string, always positive
  currency: string;
  date: string; // ISO
  accountId: string | null;
  categoryId: string | null;
  description: string | null;
  notes: string | null;
  transferGroupId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  scope: "account" | "transaction" | "both";
  kind: string | null; // asset/liability/income/expense
  icon: string | null;
  color: string | null;
}

export interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string; // decimal string
  effectiveDate: string; // ISO date
}

export interface SnapshotWithEntries extends Snapshot {
  entries: SnapshotEntry[];
}

export const DEFAULT_ACCOUNT_CATEGORIES: { name: string; kind: AccountKind }[] = [
  { name: "Checking", kind: "asset" },
  { name: "Savings", kind: "asset" },
  { name: "Cash", kind: "asset" },
  { name: "Emergency fund", kind: "asset" },
  { name: "Investments", kind: "asset" },
  { name: "Stocks & ETFs", kind: "asset" },
  { name: "Bonds", kind: "asset" },
  { name: "Retirement", kind: "asset" },
  { name: "Crypto", kind: "asset" },
  { name: "Real estate", kind: "asset" },
  { name: "Precious metals", kind: "asset" },
  { name: "Other assets", kind: "asset" },
  { name: "Credit card", kind: "liability" },
  { name: "Loans", kind: "liability" },
  { name: "Mortgage", kind: "liability" },
  { name: "Other liabilities", kind: "liability" },
];

export const BANKING_CATEGORIES = ["Checking", "Savings", "Cash", "Emergency fund"];
export const INVESTMENT_CATEGORIES = [
  "Investments",
  "Stocks & ETFs",
  "Bonds",
  "Retirement",
  "Crypto",
  "Precious metals",
];
