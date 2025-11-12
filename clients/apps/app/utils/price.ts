import { CheckoutProduct } from "@polar-sh/sdk/models/components/checkoutproduct.js";
import { LegacyRecurringProductPrice } from "@polar-sh/sdk/models/components/legacyrecurringproductprice.js";
import { Product } from "@polar-sh/sdk/models/components/product.js";
import { ProductPriceCustom } from "@polar-sh/sdk/models/components/productpricecustom.js";
import { ProductPriceFixed } from "@polar-sh/sdk/models/components/productpricefixed.js";
import { ProductPriceFree } from "@polar-sh/sdk/models/components/productpricefree.js";
import { ProductPriceMeteredUnit } from "@polar-sh/sdk/models/components/productpricemeteredunit.js";

export const hasIntervals = (
  product: CheckoutProduct
): [boolean, boolean, boolean] => {
  const hasMonthInterval = product.prices.some(
    (price) => price.type === "recurring" && price.recurringInterval === "month"
  );
  const hasYearInterval = product.prices.some(
    (price) => price.type === "recurring" && price.recurringInterval === "year"
  );
  const hasBothIntervals = hasMonthInterval && hasYearInterval;

  return [hasMonthInterval, hasYearInterval, hasBothIntervals];
};

type ProductPrice =
  | ProductPriceFixed
  | ProductPriceCustom
  | ProductPriceFree
  | ProductPriceMeteredUnit;

export const isLegacyRecurringPrice = (
  price: ProductPrice | LegacyRecurringProductPrice
): price is LegacyRecurringProductPrice => "legacy" in price;

export const hasLegacyRecurringPrices = (
  product: Product
): product is Product & {
  prices: LegacyRecurringProductPrice[];
} => product.prices.some(isLegacyRecurringPrice);

export const isStaticPrice = (
  price: ProductPrice
): price is ProductPriceFixed | ProductPriceCustom | ProductPriceFree =>
  price.amountType !== undefined &&
  ["fixed", "custom", "free"].includes(price.amountType);

export const isMeteredPrice = (
  price: ProductPrice
): price is ProductPriceMeteredUnit => price.amountType === "metered_unit";
