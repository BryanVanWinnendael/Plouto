import { pctChange, sumDecimal, parseMoneyInput, quantize, formatMoney } from "@/finance/money";
import { totalsForSnapshot, latestKnownPosition, changeSummary } from "@/finance/calculations";
import { compareSnapshots } from "@/finance/compare";
import { yearlySummaries } from "@/finance/yearly";
import { makeFxConverter } from "@/finance/allocation";
import type { Account, SnapshotWithEntries } from "@/finance/types";

const acc = (id: string, kind: "asset" | "liability", category: string, currency = "USD"): Account => ({
  id, name: id, kind, category, currency, assetClass: null, liquidity: "liquid",
  institution: null, notes: null, icon: null, color: null, sortOrder: 0, archived: 0,
  createdAt: "", updatedAt: "",
});

const fx = makeFxConverter("USD", []);

describe("money", () => {
  test("decimal precision: 0.1 + 0.2 = 0.3", () => {
    expect(sumDecimal(["0.1", "0.2"])).toBe("0.3");
  });
  test("pct zero baseline returns null", () => {
    expect(pctChange("100", "0")).toBeNull();
  });
  test("pct normal", () => {
    expect(Number(pctChange("110", "100"))).toBeCloseTo(10);
  });
  test("invalid input rejected", () => {
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("-5")).toBeNull();
    expect(parseMoneyInput("12.34")).toBe("12.34");
  });
  test("quantize JPY 0 decimals", () => {
    expect(quantize("10.6", "JPY")).toBe("11");
  });
  test("formatMoney works", () => {
    expect(formatMoney("1234.5", "USD", "en-US")).toContain("1,234.50");
  });
});

describe("net worth sign convention", () => {
  test("liabilities subtracted", () => {
    const a = acc("cash", "asset", "Cash");
    const l = acc("card", "liability", "Credit card");
    const byId = new Map([[a.id, a], [l.id, l]]);
    const snap: SnapshotWithEntries = {
      id: "s", title: null, observedAt: new Date().toISOString(), createdAt: "", updatedAt: "", notes: null,
      entries: [
        { id: "e1", snapshotId: "s", accountId: "cash", observedBalance: "1000", currency: "USD", notes: null, verified: 1, createdAt: "", updatedAt: "" },
        { id: "e2", snapshotId: "s", accountId: "card", observedBalance: "200", currency: "USD", notes: null, verified: 1, createdAt: "", updatedAt: "" },
      ],
    };
    const t = totalsForSnapshot(snap, byId, fx);
    expect(t.assets).toBe("1000");
    expect(t.liabilities).toBe("200");
    expect(t.netWorth).toBe("800");
  });

  test("missing observation excluded, not zero", () => {
    const a = acc("cash", "asset", "Cash");
    const b = acc("sav", "asset", "Savings");
    const byId = new Map([[a.id, a], [b.id, b]]);
    const snap: SnapshotWithEntries = {
      id: "s", title: null, observedAt: new Date().toISOString(), createdAt: "", updatedAt: "", notes: null,
      entries: [
        { id: "e1", snapshotId: "s", accountId: "cash", observedBalance: "500", currency: "USD", notes: null, verified: 1, createdAt: "", updatedAt: "" },
      ],
    };
    const t = totalsForSnapshot(snap, byId, fx, [a, b]);
    expect(t.assets).toBe("500");
    expect(t.missingAccountIds).toEqual(["sav"]);
    expect(t.observedAccountIds).toEqual(["cash"]);
  });
});

describe("latest-known-position", () => {
  test("picks newest per account with mixed dates", () => {
    const a = acc("cash", "asset", "Cash");
    const byId = new Map([[a.id, a]]);
    void byId;
    const s1: SnapshotWithEntries = {
      id: "1", title: null, observedAt: "2025-01-01T10:00:00Z", createdAt: "", updatedAt: "", notes: null,
      entries: [{ id: "e1", snapshotId: "1", accountId: "cash", observedBalance: "100", currency: "USD", notes: null, verified: 1, createdAt: "", updatedAt: "" }],
    };
    const s2: SnapshotWithEntries = {
      id: "2", title: null, observedAt: "2025-06-01T10:00:00Z", createdAt: "", updatedAt: "", notes: null,
      entries: [{ id: "e2", snapshotId: "2", accountId: "cash", observedBalance: "300", currency: "USD", notes: null, verified: 1, createdAt: "", updatedAt: "" }],
    };
    const lkp = latestKnownPosition([s1, s2], [a], fx);
    expect(lkp.netWorth).toBe("300");
    expect(lkp.byAccount["cash"].observedAt).toBe("2025-06-01T10:00:00Z");
  });
});

describe("compare", () => {
  test("common-only vs missing handling", () => {
    const a = acc("cash", "asset", "Cash");
    const b = acc("sav", "asset", "Savings");
    const byId = new Map([[a.id, a], [b.id, b]]);
    const mk = (id: string, at: string, entries: [string, string][]): SnapshotWithEntries => ({
      id, title: null, observedAt: at, createdAt: "", updatedAt: "", notes: null,
      entries: entries.map(([aid, bal], i) => ({
        id: `${id}-e${i}`, snapshotId: id, accountId: aid, observedBalance: bal,
        currency: "USD", notes: null, verified: 1, createdAt: "", updatedAt: "",
      })),
    });
    const A = mk("A", "2025-01-01T00:00:00Z", [["cash", "100"], ["sav", "100"]]);
    const B = mk("B", "2025-02-01T00:00:00Z", [["cash", "150"]]);
    const r = compareSnapshots(A, B, byId, fx);
    expect(r.onlyInA).toEqual(["sav"]);
    expect(r.rows.find((x) => x.accountId === "sav")!.inBoth).toBe(false);
    expect(r.rows.find((x) => x.accountId === "sav")!.change).toBeNull();
    expect(r.rows.find((x) => x.accountId === "cash")!.change).toBe("50");
  });
});

describe("yearly", () => {
  test("sparse year flagged limited", () => {
    const a = acc("cash", "asset", "Cash");
    const byId = new Map([[a.id, a]]);
    const mk = (id: string, at: string, bal: string): SnapshotWithEntries => ({
      id, title: null, observedAt: at, createdAt: "", updatedAt: "", notes: null,
      entries: [{ id: `${id}e`, snapshotId: id, accountId: "cash", observedBalance: bal, currency: "USD", notes: null, verified: 1, createdAt: "", updatedAt: "" }],
    });
    const years = yearlySummaries([mk("1", "2025-03-01T00:00:00Z", "100")], byId, fx);
    expect(years[0].limited).toBe(true);
    expect(years[0].change).toBe("0");
    const two = yearlySummaries(
      [mk("1", "2025-03-01T00:00:00Z", "100"), mk("2", "2025-12-01T00:00:00Z", "150")],
      byId, fx
    );
    expect(two[0].limited).toBe(false);
    expect(two[0].change).toBe("50");
  });
});

describe("multi-currency", () => {
  test("uses effective-date rate; missing rate => incomplete", () => {
    const a = acc("eur", "asset", "Savings", "EUR");
    const byId = new Map([[a.id, a]]);
    const fx2 = makeFxConverter("USD", [
      { fromCurrency: "EUR", toCurrency: "USD", rate: "1.1", effectiveDate: "2025-01-01T00:00:00Z" },
    ]);
    const snap: SnapshotWithEntries = {
      id: "s", title: null, observedAt: "2025-06-01T00:00:00Z", createdAt: "", updatedAt: "", notes: null,
      entries: [{ id: "e", snapshotId: "s", accountId: "eur", observedBalance: "100", currency: "EUR", notes: null, verified: 1, createdAt: "", updatedAt: "" }],
    };
    const t = totalsForSnapshot(snap, byId, fx2);
    expect(t.assets).toBe("110");
    const old: SnapshotWithEntries = { ...snap, observedAt: "2024-01-01T00:00:00Z" };
    const t2 = totalsForSnapshot(old, byId, fx2);
    expect(t2.incomplete).toBe(true);
    expect(t2.assets).toBe("0");
  });
});

describe("changeSummary", () => {
  test("zero baseline absolute only", () => {
    const c = changeSummary("50", "0", "USD");
    expect(c.absolute).toBe("50");
    expect(c.pct).toBeNull();
  });
});
