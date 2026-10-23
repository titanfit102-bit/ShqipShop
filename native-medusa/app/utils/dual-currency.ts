/**
 * Storefront-only currency presentation. The Medusa cart/order amount and
 * currency are authoritative; indicative conversion NEVER changes checkout.
 */
export type ShopCurrency = 'all' | 'eur';

export type IndicativeFxQuote = {
  available: true;
  all_per_eur: number;
  as_of: string;
  source: string;
  indicative_only: true;
};

export type UnavailableFxQuote = { available: false };

export type FxResponse = IndicativeFxQuote | UnavailableFxQuote;

export const formatShopPrice = (amount: number, currencyCode: string) => {
  if (!Number.isFinite(amount)) {
    return '—';
  }
  const currency = currencyCode.toLowerCase();
  if (currency === 'all') {
    const digits = Number.isInteger(amount) ? 0 : 2;
    const number = new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: digits,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${number} lekë`;
  }
  if (currency === 'eur') {
    const number = new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `€${number}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode.toUpperCase(),
  }).format(amount);
};

/** Guard against stale, misconfigured, or tampered quotes on the client too. */
export const isUsableFxQuote = (
  value: FxResponse | undefined,
  now: Date = new Date(),
): value is IndicativeFxQuote => {
  if (!value || !value.available) return false;
  if (
    !Number.isFinite(value.all_per_eur) ||
    value.all_per_eur <= 0 ||
    value.all_per_eur > 100000 ||
    value.indicative_only !== true ||
    !value.source?.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.as_of)
  ) {
    return false;
  }
  const date = new Date(value.as_of + 'T00:00:00Z');
  const elapsed = now.getTime() - date.getTime();
  return (
    Number.isFinite(elapsed) &&
    date.toISOString().slice(0, 10) === value.as_of &&
    elapsed >= 0 &&
    elapsed <= 7 * 24 * 60 * 60 * 1000
  );
};

export const getIndicativeConversion = (
  amount: number,
  currencyCode: string,
  quote: FxResponse | undefined,
  now?: Date,
): string | null => {
  if (!Number.isFinite(amount) || amount < 0 || !isUsableFxQuote(quote, now)) {
    return null;
  }
  const currency = currencyCode.toLowerCase();
  if (currency === 'all') {
    return `(≈ ${formatShopPrice(amount / quote.all_per_eur, 'eur')} · orientuese)`;
  }
  if (currency === 'eur') {
    return `(≈ ${formatShopPrice(amount * quote.all_per_eur, 'all')} · orientuese)`;
  }
  return null;
};
