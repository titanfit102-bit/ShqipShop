/** Application quote contract for the isolated registered checkout. */
export type CheckoutQuote = Readonly<{
  id: string;
  fingerprint: string;
  total: string;
  currency: 'all';
}>;

export function readCheckoutQuote(data: unknown): CheckoutQuote {
  const value = data as Record<string, unknown> | null;
  if (!value ||
      typeof value.quote_id !== 'string' || !/^quote_[a-f0-9-]{36}$/.test(value.quote_id) ||
      typeof value.fingerprint !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.fingerprint) ||
      typeof value.total !== 'string' || !/^(?:0|[1-9]\d*)$/.test(value.total) ||
      value.currency !== 'all') {
    throw new Error('Invalid checkout quote');
  }
  return {id: value.quote_id, fingerprint: value.fingerprint, total: value.total, currency: value.currency};
}
