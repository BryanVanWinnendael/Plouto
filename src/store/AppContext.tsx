import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import type { Account, Category, ExchangeRate, SnapshotWithEntries } from "@/finance/types";
import { getAccounts, getCategories, getRates, getSnapshotsWithEntries, getSetting, setSetting } from "@/db/repo";
import { makeFxConverter } from "@/finance/allocation";
import { latestKnownPosition, totalsForSnapshot, type ConversionContext } from "@/finance/calculations";

interface AppState {
  ready: boolean;
  accounts: Account[];
  snapshots: SnapshotWithEntries[];
  categories: Category[];
  rates: ExchangeRate[];
  reportingCurrency: string;
  locale: string | undefined;
  chartRange: string;
  onboarded: boolean;
  appLock: boolean;
  fx: ConversionContext;
  accountsById: Map<string, Account>;
  refresh: () => Promise<void>;
  setReportingCurrency: (c: string) => Promise<void>;
  setAppLock: (v: boolean) => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [ready, setReady] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotWithEntries[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [reportingCurrency, setRC] = useState("USD");
  const [chartRange, setChartRange] = useState("ALL");
  const [onboarded, setOnboarded] = useState(false);
  const [appLock, setAppLockState] = useState(false);
  const [locale, setLocale] = useState<string | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const refresh = useCallback(async () => {
    const d: SQLiteDatabase = db;
    const [a, s, c, r, rc, ob, cr, al] = await Promise.all([
      getAccounts(d), getSnapshotsWithEntries(d),
      getCategories(d), getRates(d),
      getSetting(d, "reportingCurrency"), getSetting(d, "onboarded"), getSetting(d, "chartRange"),
      getSetting(d, "appLock"),
    ]);
    if (!mounted.current) return;
    setAccounts(a); setSnapshots(s); setCategories(c); setRates(r);
    if (rc) setRC(rc);
    setOnboarded(ob === "1");
    setAppLockState(al === "1");
    if (cr) setChartRange(cr);
    try {
      const { getLocales } = require("expo-localization");
      setLocale(getLocales()?.[0]?.languageTag);
    } catch { setLocale(undefined); }
    setReady(true);
  }, [db]);

  useEffect(() => { refresh(); }, [refresh]);

  const setReportingCurrency = useCallback(async (c: string) => {
    setRC(c.toUpperCase());
    await setSetting(db, "reportingCurrency", c.toUpperCase());
  }, [db]);

  const setAppLock = useCallback(async (v: boolean) => {
    setAppLockState(v);
    await setSetting(db, "appLock", v ? "1" : "0");
  }, [db]);

  const fx = useMemo(() => makeFxConverter(reportingCurrency, rates.map((r) => ({
    fromCurrency: r.fromCurrency, toCurrency: r.toCurrency, rate: r.rate, effectiveDate: r.effectiveDate,
  }))), [reportingCurrency, rates]);

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const value: AppState = {
    ready, accounts, snapshots, categories, rates,
    reportingCurrency, locale, chartRange, onboarded, appLock, fx, accountsById,
    refresh, setReportingCurrency, setAppLock,
  };
  void latestKnownPosition;
  void totalsForSnapshot;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
