import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX", "TWD"]);
const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

export function currencyPrecision(code: string): number {
  const c = code.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(c)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(c)) return 3;
  return 2;
}

export function toDecimal(value: string | number | Decimal): Decimal {
  try {
    const d = new Decimal(value);
    if (!d.isFinite()) return new Decimal(0);
    return d;
  } catch {
    return new Decimal(0);
  }
}

/** Sum a list of decimal strings safely. */
export function sumDecimal(values: (string | number)[]): string {
  let total = new Decimal(0);
  for (const v of values) total = total.plus(toDecimal(v));
  return total.toString();
}

export function subDecimal(a: string | number, b: string | number): string {
  return toDecimal(a).minus(toDecimal(b)).toString();
}

export function mulDecimal(a: string | number, b: string | number): string {
  return toDecimal(a).times(toDecimal(b)).toString();
}

/** Percentage change = (current - base) / |base| * 100. Returns null when not meaningful. */
export function pctChange(current: string | number, base: string | number): string | null {
  const b = toDecimal(base);
  if (b.isZero()) return null;
  const c = toDecimal(current);
  return c.minus(b).div(b.abs()).times(100).toString();
}

export function quantize(amount: string | number, currency: string): string {
  const p = currencyPrecision(currency);
  return toDecimal(amount).toDecimalPlaces(p).toString();
}

/** Parse user-entered monetary input. Returns decimal string or null if invalid. */
export function parseMoneyInput(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[\s,'_]/g, "").replace(/,/g, ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  try {
    const d = new Decimal(cleaned);
    if (!d.isFinite() || d.isNegative()) return null;
    return d.toString();
  } catch {
    return null;
  }
}

export function isValidMoneyInput(raw: string): boolean {
  return parseMoneyInput(raw) !== null;
}

export function formatMoney(amount: string | number, currency: string, locale?: string): string {
  const p = currencyPrecision(currency);
  const num = toDecimal(amount).toDecimalPlaces(p).toNumber();
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: p,
      maximumFractionDigits: p,
    }).format(num);
  } catch {
    return `${currency} ${toDecimal(amount).toFixed(p)}`;
  }
}

export function formatSigned(amount: string | number, currency: string, locale?: string): string {
  const d = toDecimal(amount);
  const sign = d.isNeg() ? "−" : d.isZero() ? "" : "+";
  return `${sign}${formatMoney(d.abs().toString(), currency, locale)}`;
}

/** Short axis-friendly money label (€45K, $1.2M) so tick labels never collide with the line. */
export function formatMoneyCompact(amount: string | number, currency: string, locale?: string): string {
  const num = toDecimal(amount).toNumber();
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(num);
  } catch {
    return formatMoney(amount, currency, locale);
  }
}
