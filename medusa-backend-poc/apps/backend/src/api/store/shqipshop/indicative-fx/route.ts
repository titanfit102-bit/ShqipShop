import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Operator-supplied and date-stamped informational exchange quote.
 * Do not use this quote to create orders, change price rules, or charge cards.
 * A separate, trusted backend pricing/payment flow is mandatory for real EUR checkout.
 */
export const GET = (_req: MedusaRequest, res: MedusaResponse) => {
  res.setHeader("Cache-Control", "no-store, max-age=0")

  const asOf = process.env.SHQIPSHOP_FX_AS_OF || ""
  const source = (process.env.SHQIPSHOP_FX_SOURCE || "").trim()
  const raw = process.env.SHQIPSHOP_FX_ALL_PER_EUR || ""
  const rate = raw.trim() ? Number(raw) : NaN
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(asOf)
    ? new Date(asOf + "T00:00:00Z")
    : null
  const validDate =
    parsedDate !== null &&
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === asOf
  const elapsed = validDate ? Date.now() - parsedDate!.getTime() : NaN

  const available =
    Number.isFinite(rate) &&
    rate > 0 &&
    rate <= 100000 &&
    Boolean(source) &&
    validDate &&
    Number.isFinite(elapsed) &&
    elapsed >= 0 &&
    elapsed <= 7 * 24 * 60 * 60 * 1000

  if (!available) {
    return res.json({ available: false })
  }

  return res.json({
    available: true,
    all_per_eur: rate,
    as_of: asOf,
    source,
    indicative_only: true,
  })
}
