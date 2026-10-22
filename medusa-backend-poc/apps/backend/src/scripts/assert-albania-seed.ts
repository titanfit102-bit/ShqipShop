/** CI-only assertion of seeded Albanian demo data. No production data. */
import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export default async function assertAlbaniaSeed({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code"],
  });
  const albania = regions.find((region) => region.name === "Shqipëri");
  if (!albania || albania.currency_code !== "all") {
    throw new Error("Missing Albania commerce region with ALL currency");
  }
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.currency_code"],
  });
  if (!stores.some((store) =>
    store.supported_currencies?.some((currency) => currency.currency_code === "all")
  )) {
    throw new Error("No merchant store supports ALL");
  }
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title"],
  });
  if (!products.length) {
    throw new Error("No seeded products");
  }
  const { data: shipping } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
  });
  if (!shipping.some((option) => option.name === "Transport standard")) {
    throw new Error("Albanian shipping option not seeded");
  }
  console.log("SHQIPSHOP_ALBANIA_ASSERTIONS_PASSED");
  console.log(JSON.stringify({
    currency: albania.currency_code,
    region: albania.name,
    productCount: products.length,
    shippingOptionCount: shipping.length,
  }));
}
