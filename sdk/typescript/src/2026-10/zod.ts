import * as z from "zod/mini";

import type * as models from "./models";
import type * as webhooks from "./webhooks";

type Schema<T> = z.ZodMiniType<T>;
type ObjectSchema<T> = Schema<T> & z.core.$ZodTypeDiscriminable;

export const AggregationFunction: Schema<models.AggregationFunction> = /* @__PURE__ */ z.enum([
  "count",
  "sum",
  "max",
  "min",
  "avg",
  "unique",
]);
export const ApiVersion: Schema<models.ApiVersion> = /* @__PURE__ */ z.enum(["2026-04", "2026-10"]);
export const BenefitGrantSortProperty: Schema<models.BenefitGrantSortProperty> =
  /* @__PURE__ */ z.enum([
    "created_at",
    "-created_at",
    "granted_at",
    "-granted_at",
    "revoked_at",
    "-revoked_at",
  ]);
export const BenefitSortProperty: Schema<models.BenefitSortProperty> = /* @__PURE__ */ z.enum([
  "created_at",
  "-created_at",
  "description",
  "-description",
  "type",
  "-type",
  "user_order",
  "-user_order",
]);
export const BenefitType: Schema<models.BenefitType> = /* @__PURE__ */ z.enum([
  "custom",
  "discord",
  "github_repository",
  "downloadables",
  "license_keys",
  "meter_credit",
  "feature_flag",
  "slack_shared_channel",
]);
export const BenefitVisibility: Schema<models.BenefitVisibility> = /* @__PURE__ */ z.enum([
  "draft",
  "private",
  "public",
]);
export const BillingAddressFieldMode: Schema<models.BillingAddressFieldMode> =
  /* @__PURE__ */ z.enum(["required", "optional", "disabled"]);
export const CheckoutLinkSortProperty: Schema<models.CheckoutLinkSortProperty> =
  /* @__PURE__ */ z.enum([
    "created_at",
    "-created_at",
    "label",
    "-label",
    "success_url",
    "-success_url",
    "allow_discount_codes",
    "-allow_discount_codes",
  ]);
export const CheckoutSortProperty: Schema<models.CheckoutSortProperty> = /* @__PURE__ */ z.enum([
  "created_at",
  "-created_at",
  "expires_at",
  "-expires_at",
  "status",
  "-status",
]);
export const CheckoutStatus: Schema<models.CheckoutStatus> = /* @__PURE__ */ z.enum([
  "open",
  "expired",
  "confirmed",
  "succeeded",
  "failed",
]);
export const CountryAlpha2: Schema<models.CountryAlpha2> = /* @__PURE__ */ z.enum([
  "AD",
  "AE",
  "AF",
  "AG",
  "AI",
  "AL",
  "AM",
  "AO",
  "AQ",
  "AR",
  "AS",
  "AT",
  "AU",
  "AW",
  "AX",
  "AZ",
  "BA",
  "BB",
  "BD",
  "BE",
  "BF",
  "BG",
  "BH",
  "BI",
  "BJ",
  "BL",
  "BM",
  "BN",
  "BO",
  "BQ",
  "BR",
  "BS",
  "BT",
  "BV",
  "BW",
  "BY",
  "BZ",
  "CA",
  "CC",
  "CD",
  "CF",
  "CG",
  "CH",
  "CI",
  "CK",
  "CL",
  "CM",
  "CN",
  "CO",
  "CR",
  "CU",
  "CV",
  "CW",
  "CX",
  "CY",
  "CZ",
  "DE",
  "DJ",
  "DK",
  "DM",
  "DO",
  "DZ",
  "EC",
  "EE",
  "EG",
  "EH",
  "ER",
  "ES",
  "ET",
  "FI",
  "FJ",
  "FK",
  "FM",
  "FO",
  "FR",
  "GA",
  "GB",
  "GD",
  "GE",
  "GF",
  "GG",
  "GH",
  "GI",
  "GL",
  "GM",
  "GN",
  "GP",
  "GQ",
  "GR",
  "GS",
  "GT",
  "GU",
  "GW",
  "GY",
  "HK",
  "HM",
  "HN",
  "HR",
  "HT",
  "HU",
  "ID",
  "IE",
  "IL",
  "IM",
  "IN",
  "IO",
  "IQ",
  "IR",
  "IS",
  "IT",
  "JE",
  "JM",
  "JO",
  "JP",
  "KE",
  "KG",
  "KH",
  "KI",
  "KM",
  "KN",
  "KP",
  "KR",
  "KW",
  "KY",
  "KZ",
  "LA",
  "LB",
  "LC",
  "LI",
  "LK",
  "LR",
  "LS",
  "LT",
  "LU",
  "LV",
  "LY",
  "MA",
  "MC",
  "MD",
  "ME",
  "MF",
  "MG",
  "MH",
  "MK",
  "ML",
  "MM",
  "MN",
  "MO",
  "MP",
  "MQ",
  "MR",
  "MS",
  "MT",
  "MU",
  "MV",
  "MW",
  "MX",
  "MY",
  "MZ",
  "NA",
  "NC",
  "NE",
  "NF",
  "NG",
  "NI",
  "NL",
  "NO",
  "NP",
  "NR",
  "NU",
  "NZ",
  "OM",
  "PA",
  "PE",
  "PF",
  "PG",
  "PH",
  "PK",
  "PL",
  "PM",
  "PN",
  "PR",
  "PS",
  "PT",
  "PW",
  "PY",
  "QA",
  "RE",
  "RO",
  "RS",
  "RU",
  "RW",
  "SA",
  "SB",
  "SC",
  "SD",
  "SE",
  "SG",
  "SH",
  "SI",
  "SJ",
  "SK",
  "SL",
  "SM",
  "SN",
  "SO",
  "SR",
  "SS",
  "ST",
  "SV",
  "SX",
  "SY",
  "SZ",
  "TC",
  "TD",
  "TF",
  "TG",
  "TH",
  "TJ",
  "TK",
  "TL",
  "TM",
  "TN",
  "TO",
  "TR",
  "TT",
  "TV",
  "TW",
  "TZ",
  "UA",
  "UG",
  "UM",
  "US",
  "UY",
  "UZ",
  "VA",
  "VC",
  "VE",
  "VG",
  "VI",
  "VN",
  "VU",
  "WF",
  "WS",
  "YE",
  "YT",
  "ZA",
  "ZM",
  "ZW",
]);
export const CountryAlpha2Input: Schema<models.CountryAlpha2Input> = /* @__PURE__ */ z.enum([
  "AD",
  "AE",
  "AF",
  "AG",
  "AI",
  "AL",
  "AM",
  "AO",
  "AQ",
  "AR",
  "AS",
  "AT",
  "AU",
  "AW",
  "AX",
  "AZ",
  "BA",
  "BB",
  "BD",
  "BE",
  "BF",
  "BG",
  "BH",
  "BI",
  "BJ",
  "BL",
  "BM",
  "BN",
  "BO",
  "BQ",
  "BR",
  "BS",
  "BT",
  "BV",
  "BW",
  "BY",
  "BZ",
  "CA",
  "CC",
  "CD",
  "CF",
  "CG",
  "CH",
  "CI",
  "CK",
  "CL",
  "CM",
  "CN",
  "CO",
  "CR",
  "CV",
  "CW",
  "CX",
  "CY",
  "CZ",
  "DE",
  "DJ",
  "DK",
  "DM",
  "DO",
  "DZ",
  "EC",
  "EE",
  "EG",
  "EH",
  "ER",
  "ES",
  "ET",
  "FI",
  "FJ",
  "FK",
  "FM",
  "FO",
  "FR",
  "GA",
  "GB",
  "GD",
  "GE",
  "GF",
  "GG",
  "GH",
  "GI",
  "GL",
  "GM",
  "GN",
  "GP",
  "GQ",
  "GR",
  "GS",
  "GT",
  "GU",
  "GW",
  "GY",
  "HK",
  "HM",
  "HN",
  "HR",
  "HT",
  "HU",
  "ID",
  "IE",
  "IL",
  "IM",
  "IN",
  "IO",
  "IQ",
  "IS",
  "IT",
  "JE",
  "JM",
  "JO",
  "JP",
  "KE",
  "KG",
  "KH",
  "KI",
  "KM",
  "KN",
  "KR",
  "KW",
  "KY",
  "KZ",
  "LA",
  "LB",
  "LC",
  "LI",
  "LK",
  "LR",
  "LS",
  "LT",
  "LU",
  "LV",
  "LY",
  "MA",
  "MC",
  "MD",
  "ME",
  "MF",
  "MG",
  "MH",
  "MK",
  "ML",
  "MM",
  "MN",
  "MO",
  "MP",
  "MQ",
  "MR",
  "MS",
  "MT",
  "MU",
  "MV",
  "MW",
  "MX",
  "MY",
  "MZ",
  "NA",
  "NC",
  "NE",
  "NF",
  "NG",
  "NI",
  "NL",
  "NO",
  "NP",
  "NR",
  "NU",
  "NZ",
  "OM",
  "PA",
  "PE",
  "PF",
  "PG",
  "PH",
  "PK",
  "PL",
  "PM",
  "PN",
  "PR",
  "PS",
  "PT",
  "PW",
  "PY",
  "QA",
  "RE",
  "RO",
  "RS",
  "RW",
  "SA",
  "SB",
  "SC",
  "SD",
  "SE",
  "SG",
  "SH",
  "SI",
  "SJ",
  "SK",
  "SL",
  "SM",
  "SN",
  "SO",
  "SR",
  "SS",
  "ST",
  "SV",
  "SX",
  "SZ",
  "TC",
  "TD",
  "TF",
  "TG",
  "TH",
  "TJ",
  "TK",
  "TL",
  "TM",
  "TN",
  "TO",
  "TR",
  "TT",
  "TV",
  "TW",
  "TZ",
  "UA",
  "UG",
  "UM",
  "US",
  "UY",
  "UZ",
  "VA",
  "VC",
  "VE",
  "VG",
  "VI",
  "VN",
  "VU",
  "WF",
  "WS",
  "YE",
  "YT",
  "ZA",
  "ZM",
  "ZW",
]);
export const CustomFieldSortProperty: Schema<models.CustomFieldSortProperty> =
  /* @__PURE__ */ z.enum([
    "created_at",
    "-created_at",
    "slug",
    "-slug",
    "name",
    "-name",
    "type",
    "-type",
  ]);
export const CustomFieldType: Schema<models.CustomFieldType> = /* @__PURE__ */ z.enum([
  "text",
  "number",
  "date",
  "checkbox",
  "select",
]);
export const CustomerBenefitGrantSortProperty: Schema<models.CustomerBenefitGrantSortProperty> =
  /* @__PURE__ */ z.enum([
    "granted_at",
    "-granted_at",
    "type",
    "-type",
    "organization",
    "-organization",
    "product_benefit",
    "-product_benefit",
  ]);
export const CustomerCancellationReason: Schema<models.CustomerCancellationReason> =
  /* @__PURE__ */ z.enum([
    "customer_service",
    "low_quality",
    "missing_features",
    "switched_service",
    "too_complex",
    "too_expensive",
    "unused",
    "other",
  ]);
export const CustomerCustomerMeterSortProperty: Schema<models.CustomerCustomerMeterSortProperty> =
  /* @__PURE__ */ z.enum([
    "created_at",
    "-created_at",
    "modified_at",
    "-modified_at",
    "meter_id",
    "-meter_id",
    "meter_name",
    "-meter_name",
    "consumed_units",
    "-consumed_units",
    "credited_units",
    "-credited_units",
    "balance",
    "-balance",
  ]);
export const CustomerMeterSortProperty: Schema<models.CustomerMeterSortProperty> =
  /* @__PURE__ */ z.enum([
    "created_at",
    "-created_at",
    "modified_at",
    "-modified_at",
    "customer_id",
    "-customer_id",
    "customer_name",
    "-customer_name",
    "meter_id",
    "-meter_id",
    "meter_name",
    "-meter_name",
    "consumed_units",
    "-consumed_units",
    "credited_units",
    "-credited_units",
    "balance",
    "-balance",
  ]);
export const CustomerOrderSortProperty: Schema<models.CustomerOrderSortProperty> =
  /* @__PURE__ */ z.enum([
    "created_at",
    "-created_at",
    "amount",
    "-amount",
    "net_amount",
    "-net_amount",
    "product",
    "-product",
    "subscription",
    "-subscription",
  ]);
export const CustomerSortProperty: Schema<models.CustomerSortProperty> = /* @__PURE__ */ z.enum([
  "created_at",
  "-created_at",
  "email",
  "-email",
  "name",
  "-name",
]);
export const CustomerSubscriptionSortProperty: Schema<models.CustomerSubscriptionSortProperty> =
  /* @__PURE__ */ z.enum([
    "started_at",
    "-started_at",
    "amount",
    "-amount",
    "status",
    "-status",
    "organization",
    "-organization",
    "product",
    "-product",
  ]);
export const CustomerType: Schema<models.CustomerType> = /* @__PURE__ */ z.enum([
  "individual",
  "team",
]);
export const CustomerWalletSortProperty: Schema<models.CustomerWalletSortProperty> =
  /* @__PURE__ */ z.enum(["created_at", "-created_at", "balance", "-balance"]);
export const DiscountDuration: Schema<models.DiscountDuration> = /* @__PURE__ */ z.enum([
  "once",
  "forever",
  "repeating",
]);
export const DiscountSortProperty: Schema<models.DiscountSortProperty> = /* @__PURE__ */ z.enum([
  "created_at",
  "-created_at",
  "name",
  "-name",
  "code",
  "-code",
  "redemptions_count",
  "-redemptions_count",
  "ends_at",
  "-ends_at",
]);
export const DiscountType: Schema<models.DiscountType> = /* @__PURE__ */ z.enum([
  "fixed",
  "percentage",
]);
export const DisputeSortProperty: Schema<models.DisputeSortProperty> = /* @__PURE__ */ z.enum([
  "created_at",
  "-created_at",
  "amount",
  "-amount",
]);
export const DisputeStatus: Schema<models.DisputeStatus> = /* @__PURE__ */ z.enum([
  "prevented",
  "early_warning",
  "needs_response",
  "under_review",
  "lost",
  "won",
]);
export const EventNamesSortProperty: Schema<models.EventNamesSortProperty> = /* @__PURE__ */ z.enum(
  [
    "name",
    "-name",
    "occurrences",
    "-occurrences",
    "first_seen",
    "-first_seen",
    "last_seen",
    "-last_seen",
  ],
);
export const EventSortProperty: Schema<models.EventSortProperty> = /* @__PURE__ */ z.enum([
  "timestamp",
  "-timestamp",
]);
export const EventSource: Schema<models.EventSource> = /* @__PURE__ */ z.enum(["system", "user"]);
export const EventTypesSortProperty: Schema<models.EventTypesSortProperty> = /* @__PURE__ */ z.enum(
  [
    "name",
    "-name",
    "label",
    "-label",
    "occurrences",
    "-occurrences",
    "first_seen",
    "-first_seen",
    "last_seen",
    "-last_seen",
  ],
);
export const FileServiceTypes: Schema<models.FileServiceTypes> = /* @__PURE__ */ z.enum([
  "downloadable",
  "product_media",
  "organization_avatar",
  "support_case_attachment",
]);
export const FilterConjunction: Schema<models.FilterConjunction> = /* @__PURE__ */ z.enum([
  "and",
  "or",
]);
export const FilterOperator: Schema<models.FilterOperator> = /* @__PURE__ */ z.enum([
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "not_like",
]);
export const Func: Schema<models.Func> = /* @__PURE__ */ z.enum(["sum", "max", "min", "avg"]);
export const LicenseKeyStatus: Schema<models.LicenseKeyStatus> = /* @__PURE__ */ z.enum([
  "granted",
  "revoked",
  "disabled",
]);
export const MemberRole: Schema<models.MemberRole> = /* @__PURE__ */ z.enum([
  "owner",
  "billing_manager",
  "member",
]);
export const MemberSortProperty: Schema<models.MemberSortProperty> = /* @__PURE__ */ z.enum([
  "created_at",
  "-created_at",
]);
export const MeterSortProperty: Schema<models.MeterSortProperty> = /* @__PURE__ */ z.enum([
  "created_at",
  "-created_at",
  "name",
  "-name",
]);
export const MeterUnit: Schema<models.MeterUnit> = /* @__PURE__ */ z.enum([
  "scalar",
  "token",
  "custom",
]);
export const MetricType: Schema<models.MetricType> = /* @__PURE__ */ z.enum([
  "scalar",
  "currency",
  "currency_sub_cent",
  "percentage",
]);
export const OrderBillingReason: Schema<models.OrderBillingReason> = /* @__PURE__ */ z.enum([
  "purchase",
  "subscription_create",
  "subscription_cycle",
  "subscription_update",
  "subscription_meter_cycle",
]);
export const OrderExportColumn: Schema<models.OrderExportColumn> = /* @__PURE__ */ z.enum([
  "email",
  "created_at",
  "product",
  "net_amount",
  "currency",
  "status",
  "invoice_number",
  "customer_name",
  "billing_name",
  "billing_country",
  "subtotal_amount",
  "discount_amount",
  "tax_amount",
  "total_amount",
  "refunded_amount",
  "billing_reason",
]);
export const OrderSortProperty: Schema<models.OrderSortProperty> = /* @__PURE__ */ z.enum([
  "created_at",
  "-created_at",
  "status",
  "-status",
  "invoice_number",
  "-invoice_number",
  "amount",
  "-amount",
  "net_amount",
  "-net_amount",
  "customer",
  "-customer",
  "product",
  "-product",
  "discount",
  "-discount",
  "subscription",
  "-subscription",
]);
export const OrderStatus: Schema<models.OrderStatus> = /* @__PURE__ */ z.enum([
  "draft",
  "pending",
  "paid",
  "refunded",
  "partially_refunded",
  "void",
]);
export const OrganizationSocialPlatforms: Schema<models.OrganizationSocialPlatforms> =
  /* @__PURE__ */ z.enum([
    "x",
    "github",
    "facebook",
    "instagram",
    "youtube",
    "tiktok",
    "linkedin",
    "threads",
    "discord",
    "other",
  ]);
export const OrganizationSortProperty: Schema<models.OrganizationSortProperty> =
  /* @__PURE__ */ z.enum([
    "created_at",
    "-created_at",
    "slug",
    "-slug",
    "name",
    "-name",
    "next_review_threshold",
    "-next_review_threshold",
    "days_in_status",
    "-days_in_status",
  ]);
export const OrganizationStatus: Schema<models.OrganizationStatus> = /* @__PURE__ */ z.enum([
  "created",
  "review",
  "snoozed",
  "denied",
  "active",
  "blocked",
  "offboarding",
  "offboarded",
]);
export const PaymentProcessor: Schema<models.PaymentProcessor> = /* @__PURE__ */ z.enum(["stripe"]);
export const PaymentSortProperty: Schema<models.PaymentSortProperty> = /* @__PURE__ */ z.enum([
  "created_at",
  "-created_at",
  "status",
  "-status",
  "amount",
  "-amount",
  "method",
  "-method",
]);
export const PaymentStatus: Schema<models.PaymentStatus> = /* @__PURE__ */ z.enum([
  "pending",
  "succeeded",
  "failed",
]);
export const PaymentTrigger: Schema<models.PaymentTrigger> = /* @__PURE__ */ z.enum([
  "purchase",
  "subscription_cycle",
  "retry_dunning",
  "retry_customer",
  "retry_payment_method_update",
  "retry_admin",
]);
export const Permission: Schema<models.Permission> = /* @__PURE__ */ z.enum([
  "pull",
  "triage",
  "push",
  "maintain",
  "admin",
]);
export const PresentmentCurrency: Schema<models.PresentmentCurrency> = /* @__PURE__ */ z.enum([
  "aed",
  "all",
  "amd",
  "aoa",
  "ars",
  "aud",
  "awg",
  "azn",
  "bam",
  "bbd",
  "bdt",
  "bif",
  "bmd",
  "bnd",
  "bob",
  "brl",
  "bsd",
  "bwp",
  "bzd",
  "cad",
  "cdf",
  "chf",
  "clp",
  "cny",
  "cop",
  "crc",
  "cve",
  "czk",
  "djf",
  "dkk",
  "dop",
  "dzd",
  "egp",
  "etb",
  "eur",
  "fjd",
  "fkp",
  "gbp",
  "gel",
  "gip",
  "gmd",
  "gnf",
  "gtq",
  "gyd",
  "hkd",
  "hnl",
  "htg",
  "huf",
  "idr",
  "ils",
  "inr",
  "isk",
  "jmd",
  "jpy",
  "kes",
  "kgs",
  "khr",
  "kmf",
  "krw",
  "kyd",
  "kzt",
  "lak",
  "lkr",
  "lrd",
  "lsl",
  "mad",
  "mdl",
  "mga",
  "mkd",
  "mnt",
  "mop",
  "mur",
  "mvr",
  "mwk",
  "mxn",
  "myr",
  "mzn",
  "nad",
  "ngn",
  "nio",
  "nok",
  "npr",
  "nzd",
  "pab",
  "pen",
  "pgk",
  "php",
  "pkr",
  "pln",
  "pyg",
  "qar",
  "ron",
  "rsd",
  "rwf",
  "sar",
  "sbd",
  "scr",
  "sek",
  "sgd",
  "shp",
  "sos",
  "srd",
  "szl",
  "thb",
  "tjs",
  "top",
  "try",
  "ttd",
  "twd",
  "tzs",
  "uah",
  "ugx",
  "usd",
  "uyu",
  "uzs",
  "vnd",
  "vuv",
  "wst",
  "xaf",
  "xcd",
  "xcg",
  "xof",
  "xpf",
  "yer",
  "zar",
  "zmw",
]);
export const ProductBillingType: Schema<models.ProductBillingType> = /* @__PURE__ */ z.enum([
  "one_time",
  "recurring",
]);
export const ProductPriceSource: Schema<models.ProductPriceSource> = /* @__PURE__ */ z.enum([
  "catalog",
  "ad_hoc",
]);
export const ProductSortProperty: Schema<models.ProductSortProperty> = /* @__PURE__ */ z.enum([
  "created_at",
  "-created_at",
  "name",
  "-name",
  "price_amount_type",
  "-price_amount_type",
  "price_amount",
  "-price_amount",
]);
export const ProductVisibility: Schema<models.ProductVisibility> = /* @__PURE__ */ z.enum([
  "draft",
  "private",
  "public",
]);
export const PublicSubscriptionProrationBehavior: Schema<models.PublicSubscriptionProrationBehavior> =
  /* @__PURE__ */ z.enum(["invoice", "prorate", "next_period"]);
export const Reason: Schema<models.Reason> = /* @__PURE__ */ z.enum([
  "duplicate",
  "fraudulent",
  "customer_request",
  "service_disruption",
  "satisfaction_guarantee",
  "other",
]);
export const RecurringInterval: Schema<models.RecurringInterval> = /* @__PURE__ */ z.enum([
  "day",
  "week",
  "month",
  "year",
]);
export const RefundReason: Schema<models.RefundReason> = /* @__PURE__ */ z.enum([
  "duplicate",
  "fraudulent",
  "customer_request",
  "service_disruption",
  "satisfaction_guarantee",
  "dispute_prevention",
  "tax_refund",
  "vat_reverse_charge_correction",
  "other",
]);
export const RefundSortProperty: Schema<models.RefundSortProperty> = /* @__PURE__ */ z.enum([
  "created_at",
  "-created_at",
  "amount",
  "-amount",
]);
export const RefundStatus: Schema<models.RefundStatus> = /* @__PURE__ */ z.enum([
  "pending",
  "succeeded",
  "failed",
  "canceled",
]);
export const Role: Schema<models.Role> = /* @__PURE__ */ z.enum(["member", "billing_manager"]);
export const Scope: Schema<models.Scope> = /* @__PURE__ */ z.enum([
  "openid",
  "profile",
  "email",
  "user:read",
  "user:write",
  "organizations:read",
  "organizations:write",
  "custom_fields:read",
  "custom_fields:write",
  "discounts:read",
  "discounts:write",
  "checkout_links:read",
  "checkout_links:write",
  "checkouts:read",
  "checkouts:write",
  "transactions:read",
  "transactions:write",
  "payouts:read",
  "payouts:write",
  "products:read",
  "products:write",
  "benefits:read",
  "benefits:write",
  "events:read",
  "events:write",
  "meters:read",
  "meters:write",
  "files:read",
  "files:write",
  "subscriptions:read",
  "subscriptions:write",
  "customers:read",
  "customers:write",
  "members:read",
  "members:write",
  "wallets:read",
  "wallets:write",
  "disputes:read",
  "disputes:write",
  "customer_meters:read",
  "customer_sessions:write",
  "member_sessions:write",
  "customer_seats:read",
  "customer_seats:write",
  "orders:read",
  "orders:write",
  "refunds:read",
  "refunds:write",
  "payments:read",
  "metrics:read",
  "metrics:write",
  "webhooks:read",
  "webhooks:write",
  "license_keys:read",
  "license_keys:write",
  "customer_portal:read",
  "customer_portal:write",
  "notifications:read",
  "notifications:write",
  "notification_recipients:read",
  "notification_recipients:write",
  "organization_access_tokens:read",
  "organization_access_tokens:write",
]);
export const SeatStatus: Schema<models.SeatStatus> = /* @__PURE__ */ z.enum([
  "pending",
  "claimed",
  "revoked",
]);
export const SeatTierType: Schema<models.SeatTierType> = /* @__PURE__ */ z.enum([
  "volume",
  "graduated",
]);
export const Status: Schema<models.Status> = /* @__PURE__ */ z.enum(["granted", "disabled"]);
export const SubType: Schema<models.SubType> = /* @__PURE__ */ z.enum(["user", "organization"]);
export const SubscriptionExportColumn: Schema<models.SubscriptionExportColumn> =
  /* @__PURE__ */ z.enum([
    "email",
    "started_at",
    "product",
    "amount",
    "currency",
    "status",
    "recurring_interval",
    "customer_name",
    "billing_name",
    "billing_country",
    "net_amount",
    "discount",
    "seats",
    "current_period_start",
    "current_period_end",
    "cancel_at_period_end",
    "canceled_at",
    "ends_at",
    "ended_at",
    "cancellation_reason",
    "trial_start",
    "trial_end",
  ]);
export const SubscriptionProrationBehavior: Schema<models.SubscriptionProrationBehavior> =
  /* @__PURE__ */ z.enum(["invoice", "prorate", "next_period", "reset"]);
export const SubscriptionSortProperty: Schema<models.SubscriptionSortProperty> =
  /* @__PURE__ */ z.enum([
    "customer",
    "-customer",
    "status",
    "-status",
    "started_at",
    "-started_at",
    "current_period_end",
    "-current_period_end",
    "ended_at",
    "-ended_at",
    "ends_at",
    "-ends_at",
    "amount",
    "-amount",
    "product",
    "-product",
    "discount",
    "-discount",
  ]);
export const SubscriptionStatus: Schema<models.SubscriptionStatus> = /* @__PURE__ */ z.enum([
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
]);
export const TaxBehavior: Schema<models.TaxBehavior> = /* @__PURE__ */ z.enum([
  "inclusive",
  "exclusive",
]);
export const TaxBehaviorOption: Schema<models.TaxBehaviorOption> = /* @__PURE__ */ z.enum([
  "location",
  "inclusive",
  "exclusive",
]);
export const TierType: Schema<models.TierType> = /* @__PURE__ */ z.enum(["volume", "graduated"]);
export const TimeInterval: Schema<models.TimeInterval> = /* @__PURE__ */ z.enum([
  "year",
  "month",
  "week",
  "day",
  "hour",
]);
export const Timeframe: Schema<models.Timeframe> = /* @__PURE__ */ z.enum(["year", "month", "day"]);
export const Timezone: Schema<models.Timezone> = /* @__PURE__ */ z.enum([
  "Africa/Abidjan",
  "Africa/Accra",
  "Africa/Addis_Ababa",
  "Africa/Algiers",
  "Africa/Asmara",
  "Africa/Asmera",
  "Africa/Bamako",
  "Africa/Bangui",
  "Africa/Banjul",
  "Africa/Bissau",
  "Africa/Blantyre",
  "Africa/Brazzaville",
  "Africa/Bujumbura",
  "Africa/Cairo",
  "Africa/Casablanca",
  "Africa/Ceuta",
  "Africa/Conakry",
  "Africa/Dakar",
  "Africa/Dar_es_Salaam",
  "Africa/Djibouti",
  "Africa/Douala",
  "Africa/El_Aaiun",
  "Africa/Freetown",
  "Africa/Gaborone",
  "Africa/Harare",
  "Africa/Johannesburg",
  "Africa/Juba",
  "Africa/Kampala",
  "Africa/Khartoum",
  "Africa/Kigali",
  "Africa/Kinshasa",
  "Africa/Lagos",
  "Africa/Libreville",
  "Africa/Lome",
  "Africa/Luanda",
  "Africa/Lubumbashi",
  "Africa/Lusaka",
  "Africa/Malabo",
  "Africa/Maputo",
  "Africa/Maseru",
  "Africa/Mbabane",
  "Africa/Mogadishu",
  "Africa/Monrovia",
  "Africa/Nairobi",
  "Africa/Ndjamena",
  "Africa/Niamey",
  "Africa/Nouakchott",
  "Africa/Ouagadougou",
  "Africa/Porto-Novo",
  "Africa/Sao_Tome",
  "Africa/Timbuktu",
  "Africa/Tripoli",
  "Africa/Tunis",
  "Africa/Windhoek",
  "America/Adak",
  "America/Anchorage",
  "America/Anguilla",
  "America/Antigua",
  "America/Araguaina",
  "America/Argentina/Buenos_Aires",
  "America/Argentina/Catamarca",
  "America/Argentina/ComodRivadavia",
  "America/Argentina/Cordoba",
  "America/Argentina/Jujuy",
  "America/Argentina/La_Rioja",
  "America/Argentina/Mendoza",
  "America/Argentina/Rio_Gallegos",
  "America/Argentina/Salta",
  "America/Argentina/San_Juan",
  "America/Argentina/San_Luis",
  "America/Argentina/Tucuman",
  "America/Argentina/Ushuaia",
  "America/Aruba",
  "America/Asuncion",
  "America/Atikokan",
  "America/Atka",
  "America/Bahia",
  "America/Bahia_Banderas",
  "America/Barbados",
  "America/Belem",
  "America/Belize",
  "America/Blanc-Sablon",
  "America/Boa_Vista",
  "America/Bogota",
  "America/Boise",
  "America/Buenos_Aires",
  "America/Cambridge_Bay",
  "America/Campo_Grande",
  "America/Cancun",
  "America/Caracas",
  "America/Catamarca",
  "America/Cayenne",
  "America/Cayman",
  "America/Chicago",
  "America/Chihuahua",
  "America/Ciudad_Juarez",
  "America/Coral_Harbour",
  "America/Cordoba",
  "America/Costa_Rica",
  "America/Coyhaique",
  "America/Creston",
  "America/Cuiaba",
  "America/Curacao",
  "America/Danmarkshavn",
  "America/Dawson",
  "America/Dawson_Creek",
  "America/Denver",
  "America/Detroit",
  "America/Dominica",
  "America/Edmonton",
  "America/Eirunepe",
  "America/El_Salvador",
  "America/Ensenada",
  "America/Fort_Nelson",
  "America/Fort_Wayne",
  "America/Fortaleza",
  "America/Glace_Bay",
  "America/Godthab",
  "America/Goose_Bay",
  "America/Grand_Turk",
  "America/Grenada",
  "America/Guadeloupe",
  "America/Guatemala",
  "America/Guayaquil",
  "America/Guyana",
  "America/Halifax",
  "America/Havana",
  "America/Hermosillo",
  "America/Indiana/Indianapolis",
  "America/Indiana/Knox",
  "America/Indiana/Marengo",
  "America/Indiana/Petersburg",
  "America/Indiana/Tell_City",
  "America/Indiana/Vevay",
  "America/Indiana/Vincennes",
  "America/Indiana/Winamac",
  "America/Indianapolis",
  "America/Inuvik",
  "America/Iqaluit",
  "America/Jamaica",
  "America/Jujuy",
  "America/Juneau",
  "America/Kentucky/Louisville",
  "America/Kentucky/Monticello",
  "America/Knox_IN",
  "America/Kralendijk",
  "America/La_Paz",
  "America/Lima",
  "America/Los_Angeles",
  "America/Louisville",
  "America/Lower_Princes",
  "America/Maceio",
  "America/Managua",
  "America/Manaus",
  "America/Marigot",
  "America/Martinique",
  "America/Matamoros",
  "America/Mazatlan",
  "America/Mendoza",
  "America/Menominee",
  "America/Merida",
  "America/Metlakatla",
  "America/Mexico_City",
  "America/Miquelon",
  "America/Moncton",
  "America/Monterrey",
  "America/Montevideo",
  "America/Montreal",
  "America/Montserrat",
  "America/Nassau",
  "America/New_York",
  "America/Nipigon",
  "America/Nome",
  "America/Noronha",
  "America/North_Dakota/Beulah",
  "America/North_Dakota/Center",
  "America/North_Dakota/New_Salem",
  "America/Nuuk",
  "America/Ojinaga",
  "America/Panama",
  "America/Pangnirtung",
  "America/Paramaribo",
  "America/Phoenix",
  "America/Port-au-Prince",
  "America/Port_of_Spain",
  "America/Porto_Acre",
  "America/Porto_Velho",
  "America/Puerto_Rico",
  "America/Punta_Arenas",
  "America/Rainy_River",
  "America/Rankin_Inlet",
  "America/Recife",
  "America/Regina",
  "America/Resolute",
  "America/Rio_Branco",
  "America/Rosario",
  "America/Santa_Isabel",
  "America/Santarem",
  "America/Santiago",
  "America/Santo_Domingo",
  "America/Sao_Paulo",
  "America/Scoresbysund",
  "America/Shiprock",
  "America/Sitka",
  "America/St_Barthelemy",
  "America/St_Johns",
  "America/St_Kitts",
  "America/St_Lucia",
  "America/St_Thomas",
  "America/St_Vincent",
  "America/Swift_Current",
  "America/Tegucigalpa",
  "America/Thule",
  "America/Thunder_Bay",
  "America/Tijuana",
  "America/Toronto",
  "America/Tortola",
  "America/Vancouver",
  "America/Virgin",
  "America/Whitehorse",
  "America/Winnipeg",
  "America/Yakutat",
  "America/Yellowknife",
  "Antarctica/Casey",
  "Antarctica/Davis",
  "Antarctica/DumontDUrville",
  "Antarctica/Macquarie",
  "Antarctica/Mawson",
  "Antarctica/McMurdo",
  "Antarctica/Palmer",
  "Antarctica/Rothera",
  "Antarctica/South_Pole",
  "Antarctica/Syowa",
  "Antarctica/Troll",
  "Antarctica/Vostok",
  "Arctic/Longyearbyen",
  "Asia/Aden",
  "Asia/Almaty",
  "Asia/Amman",
  "Asia/Anadyr",
  "Asia/Aqtau",
  "Asia/Aqtobe",
  "Asia/Ashgabat",
  "Asia/Ashkhabad",
  "Asia/Atyrau",
  "Asia/Baghdad",
  "Asia/Bahrain",
  "Asia/Baku",
  "Asia/Bangkok",
  "Asia/Barnaul",
  "Asia/Beirut",
  "Asia/Bishkek",
  "Asia/Brunei",
  "Asia/Calcutta",
  "Asia/Chita",
  "Asia/Choibalsan",
  "Asia/Chongqing",
  "Asia/Chungking",
  "Asia/Colombo",
  "Asia/Dacca",
  "Asia/Damascus",
  "Asia/Dhaka",
  "Asia/Dili",
  "Asia/Dubai",
  "Asia/Dushanbe",
  "Asia/Famagusta",
  "Asia/Gaza",
  "Asia/Harbin",
  "Asia/Hebron",
  "Asia/Ho_Chi_Minh",
  "Asia/Hong_Kong",
  "Asia/Hovd",
  "Asia/Irkutsk",
  "Asia/Istanbul",
  "Asia/Jakarta",
  "Asia/Jayapura",
  "Asia/Jerusalem",
  "Asia/Kabul",
  "Asia/Kamchatka",
  "Asia/Karachi",
  "Asia/Kashgar",
  "Asia/Kathmandu",
  "Asia/Katmandu",
  "Asia/Khandyga",
  "Asia/Kolkata",
  "Asia/Krasnoyarsk",
  "Asia/Kuala_Lumpur",
  "Asia/Kuching",
  "Asia/Kuwait",
  "Asia/Macao",
  "Asia/Macau",
  "Asia/Magadan",
  "Asia/Makassar",
  "Asia/Manila",
  "Asia/Muscat",
  "Asia/Nicosia",
  "Asia/Novokuznetsk",
  "Asia/Novosibirsk",
  "Asia/Omsk",
  "Asia/Oral",
  "Asia/Phnom_Penh",
  "Asia/Pontianak",
  "Asia/Pyongyang",
  "Asia/Qatar",
  "Asia/Qostanay",
  "Asia/Qyzylorda",
  "Asia/Rangoon",
  "Asia/Riyadh",
  "Asia/Saigon",
  "Asia/Sakhalin",
  "Asia/Samarkand",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Srednekolymsk",
  "Asia/Taipei",
  "Asia/Tashkent",
  "Asia/Tbilisi",
  "Asia/Tehran",
  "Asia/Tel_Aviv",
  "Asia/Thimbu",
  "Asia/Thimphu",
  "Asia/Tokyo",
  "Asia/Tomsk",
  "Asia/Ujung_Pandang",
  "Asia/Ulaanbaatar",
  "Asia/Ulan_Bator",
  "Asia/Urumqi",
  "Asia/Ust-Nera",
  "Asia/Vientiane",
  "Asia/Vladivostok",
  "Asia/Yakutsk",
  "Asia/Yangon",
  "Asia/Yekaterinburg",
  "Asia/Yerevan",
  "Atlantic/Azores",
  "Atlantic/Bermuda",
  "Atlantic/Canary",
  "Atlantic/Cape_Verde",
  "Atlantic/Faeroe",
  "Atlantic/Faroe",
  "Atlantic/Jan_Mayen",
  "Atlantic/Madeira",
  "Atlantic/Reykjavik",
  "Atlantic/South_Georgia",
  "Atlantic/St_Helena",
  "Atlantic/Stanley",
  "Australia/ACT",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Broken_Hill",
  "Australia/Canberra",
  "Australia/Currie",
  "Australia/Darwin",
  "Australia/Eucla",
  "Australia/Hobart",
  "Australia/LHI",
  "Australia/Lindeman",
  "Australia/Lord_Howe",
  "Australia/Melbourne",
  "Australia/NSW",
  "Australia/North",
  "Australia/Perth",
  "Australia/Queensland",
  "Australia/South",
  "Australia/Sydney",
  "Australia/Tasmania",
  "Australia/Victoria",
  "Australia/West",
  "Australia/Yancowinna",
  "Brazil/Acre",
  "Brazil/DeNoronha",
  "Brazil/East",
  "Brazil/West",
  "CET",
  "CST6CDT",
  "Canada/Atlantic",
  "Canada/Central",
  "Canada/Eastern",
  "Canada/Mountain",
  "Canada/Newfoundland",
  "Canada/Pacific",
  "Canada/Saskatchewan",
  "Canada/Yukon",
  "Chile/Continental",
  "Chile/EasterIsland",
  "Cuba",
  "EET",
  "EST",
  "EST5EDT",
  "Egypt",
  "Eire",
  "Etc/GMT",
  "Etc/GMT+0",
  "Etc/GMT+1",
  "Etc/GMT+10",
  "Etc/GMT+11",
  "Etc/GMT+12",
  "Etc/GMT+2",
  "Etc/GMT+3",
  "Etc/GMT+4",
  "Etc/GMT+5",
  "Etc/GMT+6",
  "Etc/GMT+7",
  "Etc/GMT+8",
  "Etc/GMT+9",
  "Etc/GMT-0",
  "Etc/GMT-1",
  "Etc/GMT-10",
  "Etc/GMT-11",
  "Etc/GMT-12",
  "Etc/GMT-13",
  "Etc/GMT-14",
  "Etc/GMT-2",
  "Etc/GMT-3",
  "Etc/GMT-4",
  "Etc/GMT-5",
  "Etc/GMT-6",
  "Etc/GMT-7",
  "Etc/GMT-8",
  "Etc/GMT-9",
  "Etc/GMT0",
  "Etc/Greenwich",
  "Etc/UCT",
  "Etc/UTC",
  "Etc/Universal",
  "Etc/Zulu",
  "Europe/Amsterdam",
  "Europe/Andorra",
  "Europe/Astrakhan",
  "Europe/Athens",
  "Europe/Belfast",
  "Europe/Belgrade",
  "Europe/Berlin",
  "Europe/Bratislava",
  "Europe/Brussels",
  "Europe/Bucharest",
  "Europe/Budapest",
  "Europe/Busingen",
  "Europe/Chisinau",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Gibraltar",
  "Europe/Guernsey",
  "Europe/Helsinki",
  "Europe/Isle_of_Man",
  "Europe/Istanbul",
  "Europe/Jersey",
  "Europe/Kaliningrad",
  "Europe/Kiev",
  "Europe/Kirov",
  "Europe/Kyiv",
  "Europe/Lisbon",
  "Europe/Ljubljana",
  "Europe/London",
  "Europe/Luxembourg",
  "Europe/Madrid",
  "Europe/Malta",
  "Europe/Mariehamn",
  "Europe/Minsk",
  "Europe/Monaco",
  "Europe/Moscow",
  "Europe/Nicosia",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Podgorica",
  "Europe/Prague",
  "Europe/Riga",
  "Europe/Rome",
  "Europe/Samara",
  "Europe/San_Marino",
  "Europe/Sarajevo",
  "Europe/Saratov",
  "Europe/Simferopol",
  "Europe/Skopje",
  "Europe/Sofia",
  "Europe/Stockholm",
  "Europe/Tallinn",
  "Europe/Tirane",
  "Europe/Tiraspol",
  "Europe/Ulyanovsk",
  "Europe/Uzhgorod",
  "Europe/Vaduz",
  "Europe/Vatican",
  "Europe/Vienna",
  "Europe/Vilnius",
  "Europe/Volgograd",
  "Europe/Warsaw",
  "Europe/Zagreb",
  "Europe/Zaporozhye",
  "Europe/Zurich",
  "Factory",
  "GB",
  "GB-Eire",
  "GMT",
  "GMT+0",
  "GMT-0",
  "GMT0",
  "Greenwich",
  "HST",
  "Hongkong",
  "Iceland",
  "Indian/Antananarivo",
  "Indian/Chagos",
  "Indian/Christmas",
  "Indian/Cocos",
  "Indian/Comoro",
  "Indian/Kerguelen",
  "Indian/Mahe",
  "Indian/Maldives",
  "Indian/Mauritius",
  "Indian/Mayotte",
  "Indian/Reunion",
  "Iran",
  "Israel",
  "Jamaica",
  "Japan",
  "Kwajalein",
  "Libya",
  "MET",
  "MST",
  "MST7MDT",
  "Mexico/BajaNorte",
  "Mexico/BajaSur",
  "Mexico/General",
  "NZ",
  "NZ-CHAT",
  "Navajo",
  "PRC",
  "PST8PDT",
  "Pacific/Apia",
  "Pacific/Auckland",
  "Pacific/Bougainville",
  "Pacific/Chatham",
  "Pacific/Chuuk",
  "Pacific/Easter",
  "Pacific/Efate",
  "Pacific/Enderbury",
  "Pacific/Fakaofo",
  "Pacific/Fiji",
  "Pacific/Funafuti",
  "Pacific/Galapagos",
  "Pacific/Gambier",
  "Pacific/Guadalcanal",
  "Pacific/Guam",
  "Pacific/Honolulu",
  "Pacific/Johnston",
  "Pacific/Kanton",
  "Pacific/Kiritimati",
  "Pacific/Kosrae",
  "Pacific/Kwajalein",
  "Pacific/Majuro",
  "Pacific/Marquesas",
  "Pacific/Midway",
  "Pacific/Nauru",
  "Pacific/Niue",
  "Pacific/Norfolk",
  "Pacific/Noumea",
  "Pacific/Pago_Pago",
  "Pacific/Palau",
  "Pacific/Pitcairn",
  "Pacific/Pohnpei",
  "Pacific/Ponape",
  "Pacific/Port_Moresby",
  "Pacific/Rarotonga",
  "Pacific/Saipan",
  "Pacific/Samoa",
  "Pacific/Tahiti",
  "Pacific/Tarawa",
  "Pacific/Tongatapu",
  "Pacific/Truk",
  "Pacific/Wake",
  "Pacific/Wallis",
  "Pacific/Yap",
  "Poland",
  "Portugal",
  "ROC",
  "ROK",
  "Singapore",
  "Turkey",
  "UCT",
  "US/Alaska",
  "US/Aleutian",
  "US/Arizona",
  "US/Central",
  "US/East-Indiana",
  "US/Eastern",
  "US/Hawaii",
  "US/Indiana-Starke",
  "US/Michigan",
  "US/Mountain",
  "US/Pacific",
  "US/Samoa",
  "UTC",
  "Universal",
  "W-SU",
  "WET",
  "Zulu",
]);
export const TokenEndpointAuthMethod: Schema<models.TokenEndpointAuthMethod> =
  /* @__PURE__ */ z.enum(["client_secret_basic", "client_secret_post", "none"]);
export const TokenType: Schema<models.TokenType> = /* @__PURE__ */ z.enum([
  "access_token",
  "refresh_token",
]);
export const TrialInterval: Schema<models.TrialInterval> = /* @__PURE__ */ z.enum([
  "day",
  "week",
  "month",
  "year",
]);
export const WebhookEventType: Schema<models.WebhookEventType> = /* @__PURE__ */ z.enum([
  "checkout.created",
  "checkout.updated",
  "checkout.expired",
  "customer.created",
  "customer.updated",
  "customer.deleted",
  "customer.state_changed",
  "customer_seat.assigned",
  "customer_seat.claimed",
  "customer_seat.revoked",
  "member.created",
  "member.updated",
  "member.deleted",
  "order.created",
  "order.updated",
  "order.paid",
  "order.refunded",
  "subscription.created",
  "subscription.updated",
  "subscription.active",
  "subscription.canceled",
  "subscription.uncanceled",
  "subscription.cycled",
  "subscription.revoked",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.migrated",
  "refund.created",
  "refund.updated",
  "product.created",
  "product.updated",
  "discount.created",
  "discount.updated",
  "discount.deleted",
  "benefit.created",
  "benefit.updated",
  "benefit_grant.created",
  "benefit_grant.cycled",
  "benefit_grant.updated",
  "benefit_grant.revoked",
  "organization.updated",
]);
export const WebhookFormat: Schema<models.WebhookFormat> = /* @__PURE__ */ z.enum([
  "raw",
  "discord",
  "slack",
]);
export const Address: ObjectSchema<models.Address> = /* @__PURE__ */ z.looseObject({
  line1: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  line2: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  postal_code: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  city: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  state: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  country: CountryAlpha2,
});
export const AddressDict: ObjectSchema<models.AddressDict> = /* @__PURE__ */ z.looseObject({
  line1: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
  line2: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
  postal_code: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
  city: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
  state: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
  country: /* @__PURE__ */ z.string(),
});
export const AddressInput: ObjectSchema<models.AddressInput> = /* @__PURE__ */ z.looseObject({
  line1: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  line2: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  postal_code: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  city: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  state: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  country: CountryAlpha2Input,
});
export const AlreadyActiveSubscriptionError: ObjectSchema<models.AlreadyActiveSubscriptionError> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("AlreadyActiveSubscriptionError"),
    detail: /* @__PURE__ */ z.string(),
  });
export const AlreadyCanceledSubscription: ObjectSchema<models.AlreadyCanceledSubscription> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("AlreadyCanceledSubscription"),
    detail: /* @__PURE__ */ z.string(),
  });
export const AmbiguousExternalCustomerID: ObjectSchema<models.AmbiguousExternalCustomerID> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("AmbiguousExternalCustomerID"),
    detail: /* @__PURE__ */ z.string(),
  });
export const AttachedCustomField: ObjectSchema<models.AttachedCustomField> =
  /* @__PURE__ */ z.looseObject({
    custom_field_id: /* @__PURE__ */ z.string(),
    get custom_field() {
      return CustomField;
    },
    order: /* @__PURE__ */ z.int(),
    required: /* @__PURE__ */ z.boolean(),
  });
export const AttachedCustomFieldCreate: ObjectSchema<models.AttachedCustomFieldCreate> =
  /* @__PURE__ */ z.looseObject({
    custom_field_id: /* @__PURE__ */ z.string(),
    required: /* @__PURE__ */ z.boolean(),
  });
export const AuthorizeOrganization: ObjectSchema<models.AuthorizeOrganization> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    slug: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    avatar_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const AuthorizeResponseOrganization: ObjectSchema<models.AuthorizeResponseOrganization> =
  /* @__PURE__ */ z.looseObject({
    get client() {
      return OAuth2ClientPublic;
    },
    sub_type: /* @__PURE__ */ z.literal("organization"),
    get sub() {
      return /* @__PURE__ */ z.nullable(AuthorizeOrganization);
    },
    scopes: /* @__PURE__ */ z.array(Scope),
    get organizations() {
      return /* @__PURE__ */ z.array(AuthorizeOrganization);
    },
    requires_single_organization: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    scope_display_names: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.string()),
    ),
  });
export const AuthorizeResponseUser: ObjectSchema<models.AuthorizeResponseUser> =
  /* @__PURE__ */ z.looseObject({
    get client() {
      return OAuth2ClientPublic;
    },
    sub_type: /* @__PURE__ */ z.literal("user"),
    get sub() {
      return /* @__PURE__ */ z.nullable(AuthorizeUser);
    },
    scopes: /* @__PURE__ */ z.array(Scope),
    get organizations() {
      return /* @__PURE__ */ z.array(AuthorizeOrganization);
    },
    requires_single_organization: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    scope_display_names: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.string()),
    ),
  });
export const AuthorizeUser: ObjectSchema<models.AuthorizeUser> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  email: /* @__PURE__ */ z.string(),
  avatar_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
});
export const BadRequest: ObjectSchema<models.BadRequest> = /* @__PURE__ */ z.looseObject({
  error: /* @__PURE__ */ z.literal("BadRequest"),
  detail: /* @__PURE__ */ z.string(),
});
export const BalanceCreditOrderEvent: ObjectSchema<models.BalanceCreditOrderEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("balance.credit_order"),
    get metadata() {
      return BalanceCreditOrderMetadata;
    },
  });
export const BalanceCreditOrderMetadata: ObjectSchema<models.BalanceCreditOrderMetadata> =
  /* @__PURE__ */ z.looseObject({
    order_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    subscription_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    tax_amount: /* @__PURE__ */ z.int(),
    tax_state: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    tax_country: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    fee: /* @__PURE__ */ z.int(),
    exchange_rate: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.number()),
  });
export const BalanceDisputeEvent: ObjectSchema<models.BalanceDisputeEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("balance.dispute"),
    get metadata() {
      return BalanceDisputeMetadata;
    },
  });
export const BalanceDisputeMetadata: ObjectSchema<models.BalanceDisputeMetadata> =
  /* @__PURE__ */ z.looseObject({
    transaction_id: /* @__PURE__ */ z.string(),
    dispute_id: /* @__PURE__ */ z.string(),
    order_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    order_created_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    subscription_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    presentment_amount: /* @__PURE__ */ z.int(),
    presentment_currency: /* @__PURE__ */ z.string(),
    tax_amount: /* @__PURE__ */ z.int(),
    tax_state: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    tax_country: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    fee: /* @__PURE__ */ z.int(),
    exchange_rate: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.number()),
  });
export const BalanceDisputeReversalEvent: ObjectSchema<models.BalanceDisputeReversalEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("balance.dispute_reversal"),
    get metadata() {
      return BalanceDisputeMetadata;
    },
  });
export const BalanceOrderEvent: ObjectSchema<models.BalanceOrderEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("balance.order"),
    get metadata() {
      return BalanceOrderMetadata;
    },
  });
export const BalanceOrderMetadata: ObjectSchema<models.BalanceOrderMetadata> =
  /* @__PURE__ */ z.looseObject({
    transaction_id: /* @__PURE__ */ z.string(),
    order_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    subscription_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    amount: /* @__PURE__ */ z.int(),
    net_amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    currency: /* @__PURE__ */ z.string(),
    presentment_amount: /* @__PURE__ */ z.int(),
    presentment_currency: /* @__PURE__ */ z.string(),
    tax_amount: /* @__PURE__ */ z.int(),
    tax_state: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    tax_country: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    fee: /* @__PURE__ */ z.int(),
    exchange_rate: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.number()),
  });
export const BalanceRefundEvent: ObjectSchema<models.BalanceRefundEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("balance.refund"),
    get metadata() {
      return BalanceRefundMetadata;
    },
  });
export const BalanceRefundMetadata: ObjectSchema<models.BalanceRefundMetadata> =
  /* @__PURE__ */ z.looseObject({
    transaction_id: /* @__PURE__ */ z.string(),
    refund_id: /* @__PURE__ */ z.string(),
    order_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    order_created_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    subscription_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    presentment_amount: /* @__PURE__ */ z.int(),
    presentment_currency: /* @__PURE__ */ z.string(),
    refundable_amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    tax_amount: /* @__PURE__ */ z.int(),
    tax_state: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    tax_country: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    fee: /* @__PURE__ */ z.int(),
    exchange_rate: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.number()),
  });
export const BalanceRefundReversalEvent: ObjectSchema<models.BalanceRefundReversalEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("balance.refund_reversal"),
    get metadata() {
      return BalanceRefundMetadata;
    },
  });
export const BenefitCustom: ObjectSchema<models.BenefitCustom> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  type: /* @__PURE__ */ z.literal("custom"),
  description: /* @__PURE__ */ z.string(),
  selectable: /* @__PURE__ */ z.boolean(),
  deletable: /* @__PURE__ */ z.boolean(),
  is_deleted: /* @__PURE__ */ z.boolean(),
  organization_id: /* @__PURE__ */ z.string(),
  get metadata() {
    return MetadataOutputType;
  },
  visibility: BenefitVisibility,
  get properties() {
    return BenefitCustomProperties;
  },
  visibility_configurable: /* @__PURE__ */ z.boolean(),
});
export const BenefitCustomCreate: ObjectSchema<models.BenefitCustomCreate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    type: /* @__PURE__ */ z.literal("custom"),
    description: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    visibility: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitVisibility)),
    get properties() {
      return BenefitCustomCreateProperties;
    },
  });
export const BenefitCustomCreateProperties: ObjectSchema<models.BenefitCustomCreateProperties> =
  /* @__PURE__ */ z.looseObject({
    note: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    ),
  });
export const BenefitCustomProperties: ObjectSchema<models.BenefitCustomProperties> =
  /* @__PURE__ */ z.looseObject({
    note: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const BenefitCustomPublic: ObjectSchema<models.BenefitCustomPublic> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("custom"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
  });
export const BenefitCustomSubscriber: ObjectSchema<models.BenefitCustomSubscriber> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("custom"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get organization() {
      return BenefitSubscriberOrganization;
    },
    get properties() {
      return BenefitCustomSubscriberProperties;
    },
  });
export const BenefitCustomSubscriberProperties: ObjectSchema<models.BenefitCustomSubscriberProperties> =
  /* @__PURE__ */ z.looseObject({
    note: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const BenefitCustomUpdate: ObjectSchema<models.BenefitCustomUpdate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    description: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    visibility: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitVisibility)),
    type: /* @__PURE__ */ z.literal("custom"),
    get properties() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitCustomProperties));
    },
  });
export const BenefitCycledEvent: ObjectSchema<models.BenefitCycledEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("benefit.cycled"),
    get metadata() {
      return BenefitGrantMetadata;
    },
  });
export const BenefitDiscord: ObjectSchema<models.BenefitDiscord> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  type: /* @__PURE__ */ z.literal("discord"),
  description: /* @__PURE__ */ z.string(),
  selectable: /* @__PURE__ */ z.boolean(),
  deletable: /* @__PURE__ */ z.boolean(),
  is_deleted: /* @__PURE__ */ z.boolean(),
  organization_id: /* @__PURE__ */ z.string(),
  get metadata() {
    return MetadataOutputType;
  },
  visibility: BenefitVisibility,
  get properties() {
    return BenefitDiscordProperties;
  },
  visibility_configurable: /* @__PURE__ */ z.boolean(),
});
export const BenefitDiscordCreate: ObjectSchema<models.BenefitDiscordCreate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    type: /* @__PURE__ */ z.literal("discord"),
    description: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    visibility: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitVisibility)),
    get properties() {
      return BenefitDiscordCreateProperties;
    },
  });
export const BenefitDiscordCreateProperties: ObjectSchema<models.BenefitDiscordCreateProperties> =
  /* @__PURE__ */ z.looseObject({
    guild_id: /* @__PURE__ */ z.string(),
    role_id: /* @__PURE__ */ z.string(),
    kick_member: /* @__PURE__ */ z.boolean(),
  });
export const BenefitDiscordProperties: ObjectSchema<models.BenefitDiscordProperties> =
  /* @__PURE__ */ z.looseObject({
    guild_id: /* @__PURE__ */ z.string(),
    role_id: /* @__PURE__ */ z.string(),
    kick_member: /* @__PURE__ */ z.boolean(),
  });
export const BenefitDiscordPublic: ObjectSchema<models.BenefitDiscordPublic> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("discord"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
  });
export const BenefitDiscordSubscriber: ObjectSchema<models.BenefitDiscordSubscriber> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("discord"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get organization() {
      return BenefitSubscriberOrganization;
    },
    get properties() {
      return BenefitDiscordSubscriberProperties;
    },
  });
export const BenefitDiscordSubscriberProperties: ObjectSchema<models.BenefitDiscordSubscriberProperties> =
  /* @__PURE__ */ z.looseObject({ guild_id: /* @__PURE__ */ z.string() });
export const BenefitDiscordUpdate: ObjectSchema<models.BenefitDiscordUpdate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    description: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    type: /* @__PURE__ */ z.literal("discord"),
    get properties() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitDiscordCreateProperties));
    },
  });
export const BenefitDownloadableFile: ObjectSchema<models.BenefitDownloadableFile> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    path: /* @__PURE__ */ z.string(),
    mime_type: /* @__PURE__ */ z.string(),
    size: /* @__PURE__ */ z.int(),
    storage_version: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checksum_etag: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checksum_sha256_base64: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checksum_sha256_hex: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    last_modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    version: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    service: /* @__PURE__ */ z.literal("downloadable"),
    is_uploaded: /* @__PURE__ */ z.boolean(),
    created_at: /* @__PURE__ */ z.string(),
    flagged_malicious_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    downloaders: /* @__PURE__ */ z.int(),
    downloads: /* @__PURE__ */ z.int(),
    size_readable: /* @__PURE__ */ z.string(),
  });
export const BenefitDownloadables: ObjectSchema<models.BenefitDownloadables> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("downloadables"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    visibility: BenefitVisibility,
    get properties() {
      return BenefitDownloadablesProperties;
    },
    visibility_configurable: /* @__PURE__ */ z.boolean(),
  });
export const BenefitDownloadablesCreate: ObjectSchema<models.BenefitDownloadablesCreate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    type: /* @__PURE__ */ z.literal("downloadables"),
    description: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    visibility: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitVisibility)),
    get properties() {
      return BenefitDownloadablesCreateProperties;
    },
  });
export const BenefitDownloadablesCreateProperties: ObjectSchema<models.BenefitDownloadablesCreateProperties> =
  /* @__PURE__ */ z.looseObject({
    archived: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.boolean()),
    ),
    files: /* @__PURE__ */ z.array(/* @__PURE__ */ z.string()),
  });
export const BenefitDownloadablesProperties: ObjectSchema<models.BenefitDownloadablesProperties> =
  /* @__PURE__ */ z.looseObject({
    archived: /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.boolean()),
    files: /* @__PURE__ */ z.array(/* @__PURE__ */ z.string()),
  });
export const BenefitDownloadablesPublic: ObjectSchema<models.BenefitDownloadablesPublic> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("downloadables"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
  });
export const BenefitDownloadablesSubscriber: ObjectSchema<models.BenefitDownloadablesSubscriber> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("downloadables"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get organization() {
      return BenefitSubscriberOrganization;
    },
    get properties() {
      return BenefitDownloadablesSubscriberProperties;
    },
  });
export const BenefitDownloadablesSubscriberProperties: ObjectSchema<models.BenefitDownloadablesSubscriberProperties> =
  /* @__PURE__ */ z.looseObject({
    active_files: /* @__PURE__ */ z.array(/* @__PURE__ */ z.string()),
  });
export const BenefitDownloadablesUpdate: ObjectSchema<models.BenefitDownloadablesUpdate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    description: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    type: /* @__PURE__ */ z.literal("downloadables"),
    get properties() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(BenefitDownloadablesCreateProperties),
      );
    },
  });
export const BenefitFeatureFlag: ObjectSchema<models.BenefitFeatureFlag> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("feature_flag"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    visibility: BenefitVisibility,
    get properties() {
      return BenefitFeatureFlagProperties;
    },
    visibility_configurable: /* @__PURE__ */ z.boolean(),
  });
export const BenefitFeatureFlagCreate: ObjectSchema<models.BenefitFeatureFlagCreate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    type: /* @__PURE__ */ z.literal("feature_flag"),
    description: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    visibility: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitVisibility)),
    get properties() {
      return BenefitFeatureFlagCreateProperties;
    },
  });
export const BenefitFeatureFlagCreateProperties: ObjectSchema<models.BenefitFeatureFlagCreateProperties> =
  /* @__PURE__ */ z.looseObject({}) as never;
export const BenefitFeatureFlagProperties: ObjectSchema<models.BenefitFeatureFlagProperties> =
  /* @__PURE__ */ z.looseObject({}) as never;
export const BenefitFeatureFlagPublic: ObjectSchema<models.BenefitFeatureFlagPublic> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("feature_flag"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
  });
export const BenefitFeatureFlagSubscriber: ObjectSchema<models.BenefitFeatureFlagSubscriber> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("feature_flag"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get organization() {
      return BenefitSubscriberOrganization;
    },
    get properties() {
      return BenefitFeatureFlagSubscriberProperties;
    },
  });
export const BenefitFeatureFlagSubscriberProperties: ObjectSchema<models.BenefitFeatureFlagSubscriberProperties> =
  /* @__PURE__ */ z.looseObject({}) as never;
export const BenefitFeatureFlagUpdate: ObjectSchema<models.BenefitFeatureFlagUpdate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    description: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    visibility: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitVisibility)),
    type: /* @__PURE__ */ z.literal("feature_flag"),
    get properties() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitFeatureFlagProperties));
    },
  });
export const BenefitGitHubRepository: ObjectSchema<models.BenefitGitHubRepository> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("github_repository"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    visibility: BenefitVisibility,
    get properties() {
      return BenefitGitHubRepositoryProperties;
    },
    visibility_configurable: /* @__PURE__ */ z.boolean(),
  });
export const BenefitGitHubRepositoryCreate: ObjectSchema<models.BenefitGitHubRepositoryCreate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    type: /* @__PURE__ */ z.literal("github_repository"),
    description: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    visibility: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitVisibility)),
    get properties() {
      return BenefitGitHubRepositoryCreateProperties;
    },
  });
export const BenefitGitHubRepositoryCreateProperties: ObjectSchema<models.BenefitGitHubRepositoryCreateProperties> =
  /* @__PURE__ */ z.looseObject({
    repository_owner: /* @__PURE__ */ z.string(),
    repository_name: /* @__PURE__ */ z.string(),
    permission: Permission,
  });
export const BenefitGitHubRepositoryProperties: ObjectSchema<models.BenefitGitHubRepositoryProperties> =
  /* @__PURE__ */ z.looseObject({
    repository_owner: /* @__PURE__ */ z.string(),
    repository_name: /* @__PURE__ */ z.string(),
    permission: Permission,
  });
export const BenefitGitHubRepositoryPublic: ObjectSchema<models.BenefitGitHubRepositoryPublic> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("github_repository"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
  });
export const BenefitGitHubRepositorySubscriber: ObjectSchema<models.BenefitGitHubRepositorySubscriber> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("github_repository"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get organization() {
      return BenefitSubscriberOrganization;
    },
    get properties() {
      return BenefitGitHubRepositorySubscriberProperties;
    },
  });
export const BenefitGitHubRepositorySubscriberProperties: ObjectSchema<models.BenefitGitHubRepositorySubscriberProperties> =
  /* @__PURE__ */ z.looseObject({
    repository_owner: /* @__PURE__ */ z.string(),
    repository_name: /* @__PURE__ */ z.string(),
  });
export const BenefitGitHubRepositoryUpdate: ObjectSchema<models.BenefitGitHubRepositoryUpdate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    description: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    type: /* @__PURE__ */ z.literal("github_repository"),
    get properties() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(BenefitGitHubRepositoryCreateProperties),
      );
    },
  });
export const BenefitGrant: ObjectSchema<models.BenefitGrant> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  granted_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  is_granted: /* @__PURE__ */ z.boolean(),
  revoked_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  is_revoked: /* @__PURE__ */ z.boolean(),
  subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  customer_id: /* @__PURE__ */ z.string(),
  member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  benefit_id: /* @__PURE__ */ z.string(),
  get error() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
  },
  get customer() {
    return Customer;
  },
  get member() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Member));
  },
  get benefit() {
    return Benefit;
  },
  get properties() {
    return /* @__PURE__ */ z.union([
      BenefitGrantDiscordProperties,
      BenefitGrantGitHubRepositoryProperties,
      BenefitGrantDownloadablesProperties,
      BenefitGrantLicenseKeysProperties,
      BenefitGrantCustomProperties,
      BenefitGrantFeatureFlagProperties,
      BenefitGrantSlackSharedChannelProperties,
    ]);
  },
});
export const BenefitGrantCustomProperties: ObjectSchema<models.BenefitGrantCustomProperties> =
  /* @__PURE__ */ z.looseObject({}) as never;
export const BenefitGrantCustomWebhook: ObjectSchema<models.BenefitGrantCustomWebhook> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_granted: /* @__PURE__ */ z.boolean(),
    revoked_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_revoked: /* @__PURE__ */ z.boolean(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return Customer;
    },
    get member() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Member));
    },
    get benefit() {
      return BenefitCustom;
    },
    get properties() {
      return BenefitGrantCustomProperties;
    },
    get previous_properties() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantCustomProperties));
    },
  });
export const BenefitGrantDiscordProperties: ObjectSchema<models.BenefitGrantDiscordProperties> =
  /* @__PURE__ */ z.looseObject({
    account_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    guild_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    role_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    granted_account_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
  });
export const BenefitGrantDiscordWebhook: ObjectSchema<models.BenefitGrantDiscordWebhook> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_granted: /* @__PURE__ */ z.boolean(),
    revoked_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_revoked: /* @__PURE__ */ z.boolean(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return Customer;
    },
    get member() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Member));
    },
    get benefit() {
      return BenefitDiscord;
    },
    get properties() {
      return BenefitGrantDiscordProperties;
    },
    get previous_properties() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantDiscordProperties));
    },
  });
export const BenefitGrantDownloadablesProperties: ObjectSchema<models.BenefitGrantDownloadablesProperties> =
  /* @__PURE__ */ z.looseObject({
    files: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
  });
export const BenefitGrantDownloadablesWebhook: ObjectSchema<models.BenefitGrantDownloadablesWebhook> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_granted: /* @__PURE__ */ z.boolean(),
    revoked_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_revoked: /* @__PURE__ */ z.boolean(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return Customer;
    },
    get member() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Member));
    },
    get benefit() {
      return BenefitDownloadables;
    },
    get properties() {
      return BenefitGrantDownloadablesProperties;
    },
    get previous_properties() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(BenefitGrantDownloadablesProperties),
      );
    },
  });
export const BenefitGrantError: ObjectSchema<models.BenefitGrantError> =
  /* @__PURE__ */ z.looseObject({
    message: /* @__PURE__ */ z.string(),
    type: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
  });
export const BenefitGrantFeatureFlagProperties: ObjectSchema<models.BenefitGrantFeatureFlagProperties> =
  /* @__PURE__ */ z.looseObject({}) as never;
export const BenefitGrantFeatureFlagWebhook: ObjectSchema<models.BenefitGrantFeatureFlagWebhook> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_granted: /* @__PURE__ */ z.boolean(),
    revoked_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_revoked: /* @__PURE__ */ z.boolean(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return Customer;
    },
    get member() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Member));
    },
    get benefit() {
      return BenefitFeatureFlag;
    },
    get properties() {
      return BenefitGrantFeatureFlagProperties;
    },
    get previous_properties() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(BenefitGrantFeatureFlagProperties),
      );
    },
  });
export const BenefitGrantGitHubRepositoryProperties: ObjectSchema<models.BenefitGrantGitHubRepositoryProperties> =
  /* @__PURE__ */ z.looseObject({
    account_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    repository_owner: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    repository_name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    permission: /* @__PURE__ */ z.optional(Permission),
    granted_account_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
  });
export const BenefitGrantGitHubRepositoryWebhook: ObjectSchema<models.BenefitGrantGitHubRepositoryWebhook> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_granted: /* @__PURE__ */ z.boolean(),
    revoked_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_revoked: /* @__PURE__ */ z.boolean(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return Customer;
    },
    get member() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Member));
    },
    get benefit() {
      return BenefitGitHubRepository;
    },
    get properties() {
      return BenefitGrantGitHubRepositoryProperties;
    },
    get previous_properties() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(BenefitGrantGitHubRepositoryProperties),
      );
    },
  });
export const BenefitGrantLicenseKeysProperties: ObjectSchema<models.BenefitGrantLicenseKeysProperties> =
  /* @__PURE__ */ z.looseObject({
    user_provided_key: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    license_key_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    display_key: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
  });
export const BenefitGrantLicenseKeysWebhook: ObjectSchema<models.BenefitGrantLicenseKeysWebhook> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_granted: /* @__PURE__ */ z.boolean(),
    revoked_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_revoked: /* @__PURE__ */ z.boolean(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return Customer;
    },
    get member() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Member));
    },
    get benefit() {
      return BenefitLicenseKeys;
    },
    get properties() {
      return BenefitGrantLicenseKeysProperties;
    },
    get previous_properties() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(BenefitGrantLicenseKeysProperties),
      );
    },
  });
export const BenefitGrantMetadata: ObjectSchema<models.BenefitGrantMetadata> =
  /* @__PURE__ */ z.looseObject({
    benefit_id: /* @__PURE__ */ z.string(),
    benefit_grant_id: /* @__PURE__ */ z.string(),
    benefit_type: BenefitType,
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
  });
export const BenefitGrantMeterCreditProperties: ObjectSchema<models.BenefitGrantMeterCreditProperties> =
  /* @__PURE__ */ z.looseObject({
    last_credited_meter_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    last_credited_units: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    last_credited_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
  });
export const BenefitGrantMeterCreditWebhook: ObjectSchema<models.BenefitGrantMeterCreditWebhook> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_granted: /* @__PURE__ */ z.boolean(),
    revoked_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_revoked: /* @__PURE__ */ z.boolean(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return Customer;
    },
    get member() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Member));
    },
    get benefit() {
      return BenefitMeterCredit;
    },
    get properties() {
      return BenefitGrantMeterCreditProperties;
    },
    get previous_properties() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(BenefitGrantMeterCreditProperties),
      );
    },
  });
export const BenefitGrantSlackSharedChannelProperties: ObjectSchema<models.BenefitGrantSlackSharedChannelProperties> =
  /* @__PURE__ */ z.looseObject({
    invited_email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    channel_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    channel_name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    invite_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    invite_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    connected_team_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
  });
export const BenefitGrantSlackSharedChannelWebhook: ObjectSchema<models.BenefitGrantSlackSharedChannelWebhook> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_granted: /* @__PURE__ */ z.boolean(),
    revoked_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    is_revoked: /* @__PURE__ */ z.boolean(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return Customer;
    },
    get member() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Member));
    },
    get benefit() {
      return BenefitSlackSharedChannel;
    },
    get properties() {
      return BenefitGrantSlackSharedChannelProperties;
    },
    get previous_properties() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(BenefitGrantSlackSharedChannelProperties),
      );
    },
  });
export const BenefitGrantedEvent: ObjectSchema<models.BenefitGrantedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("benefit.granted"),
    get metadata() {
      return BenefitGrantMetadata;
    },
  });
export const BenefitLicenseKeyActivationCreateProperties: ObjectSchema<models.BenefitLicenseKeyActivationCreateProperties> =
  /* @__PURE__ */ z.looseObject({
    limit: /* @__PURE__ */ z.int(),
    enable_customer_admin: /* @__PURE__ */ z.boolean(),
  });
export const BenefitLicenseKeyActivationProperties: ObjectSchema<models.BenefitLicenseKeyActivationProperties> =
  /* @__PURE__ */ z.looseObject({
    limit: /* @__PURE__ */ z.int(),
    enable_customer_admin: /* @__PURE__ */ z.boolean(),
  });
export const BenefitLicenseKeyExpirationProperties: ObjectSchema<models.BenefitLicenseKeyExpirationProperties> =
  /* @__PURE__ */ z.looseObject({ ttl: /* @__PURE__ */ z.int(), timeframe: Timeframe });
export const BenefitLicenseKeys: ObjectSchema<models.BenefitLicenseKeys> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("license_keys"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    visibility: BenefitVisibility,
    get properties() {
      return BenefitLicenseKeysProperties;
    },
    visibility_configurable: /* @__PURE__ */ z.boolean(),
  });
export const BenefitLicenseKeysCreate: ObjectSchema<models.BenefitLicenseKeysCreate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    type: /* @__PURE__ */ z.literal("license_keys"),
    description: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    visibility: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitVisibility)),
    get properties() {
      return BenefitLicenseKeysCreateProperties;
    },
  });
export const BenefitLicenseKeysCreateProperties: ObjectSchema<models.BenefitLicenseKeysCreateProperties> =
  /* @__PURE__ */ z.looseObject({
    prefix: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    get expires() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(BenefitLicenseKeyExpirationProperties),
      );
    },
    get activations() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(BenefitLicenseKeyActivationCreateProperties),
      );
    },
    limit_usage: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  });
export const BenefitLicenseKeysProperties: ObjectSchema<models.BenefitLicenseKeysProperties> =
  /* @__PURE__ */ z.looseObject({
    prefix: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get expires() {
      return /* @__PURE__ */ z.nullable(BenefitLicenseKeyExpirationProperties);
    },
    get activations() {
      return /* @__PURE__ */ z.nullable(BenefitLicenseKeyActivationProperties);
    },
    limit_usage: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  });
export const BenefitLicenseKeysPublic: ObjectSchema<models.BenefitLicenseKeysPublic> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("license_keys"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
  });
export const BenefitLicenseKeysSubscriber: ObjectSchema<models.BenefitLicenseKeysSubscriber> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("license_keys"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get organization() {
      return BenefitSubscriberOrganization;
    },
    get properties() {
      return BenefitLicenseKeysSubscriberProperties;
    },
  });
export const BenefitLicenseKeysSubscriberProperties: ObjectSchema<models.BenefitLicenseKeysSubscriberProperties> =
  /* @__PURE__ */ z.looseObject({
    prefix: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get expires() {
      return /* @__PURE__ */ z.nullable(BenefitLicenseKeyExpirationProperties);
    },
    get activations() {
      return /* @__PURE__ */ z.nullable(BenefitLicenseKeyActivationProperties);
    },
    limit_usage: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  });
export const BenefitLicenseKeysUpdate: ObjectSchema<models.BenefitLicenseKeysUpdate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    description: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    visibility: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitVisibility)),
    type: /* @__PURE__ */ z.literal("license_keys"),
    get properties() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(BenefitLicenseKeysCreateProperties),
      );
    },
  });
export const BenefitMeterCredit: ObjectSchema<models.BenefitMeterCredit> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("meter_credit"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    visibility: BenefitVisibility,
    get properties() {
      return BenefitMeterCreditProperties;
    },
    visibility_configurable: /* @__PURE__ */ z.boolean(),
  });
export const BenefitMeterCreditCreate: ObjectSchema<models.BenefitMeterCreditCreate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    type: /* @__PURE__ */ z.literal("meter_credit"),
    description: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    visibility: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitVisibility)),
    get properties() {
      return BenefitMeterCreditCreateProperties;
    },
  });
export const BenefitMeterCreditCreateProperties: ObjectSchema<models.BenefitMeterCreditCreateProperties> =
  /* @__PURE__ */ z.looseObject({
    units: /* @__PURE__ */ z.int(),
    rollover: /* @__PURE__ */ z.boolean(),
    meter_id: /* @__PURE__ */ z.string(),
  });
export const BenefitMeterCreditProperties: ObjectSchema<models.BenefitMeterCreditProperties> =
  /* @__PURE__ */ z.looseObject({
    units: /* @__PURE__ */ z.int(),
    rollover: /* @__PURE__ */ z.boolean(),
    meter_id: /* @__PURE__ */ z.string(),
  });
export const BenefitMeterCreditPublic: ObjectSchema<models.BenefitMeterCreditPublic> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("meter_credit"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get properties() {
      return BenefitMeterCreditPublicProperties;
    },
  });
export const BenefitMeterCreditPublicProperties: ObjectSchema<models.BenefitMeterCreditPublicProperties> =
  /* @__PURE__ */ z.looseObject({
    units: /* @__PURE__ */ z.int(),
    meter_id: /* @__PURE__ */ z.string(),
  });
export const BenefitMeterCreditSubscriber: ObjectSchema<models.BenefitMeterCreditSubscriber> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("meter_credit"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get organization() {
      return BenefitSubscriberOrganization;
    },
    get properties() {
      return BenefitMeterCreditSubscriberProperties;
    },
  });
export const BenefitMeterCreditSubscriberProperties: ObjectSchema<models.BenefitMeterCreditSubscriberProperties> =
  /* @__PURE__ */ z.looseObject({
    units: /* @__PURE__ */ z.int(),
    rollover: /* @__PURE__ */ z.boolean(),
    meter_id: /* @__PURE__ */ z.string(),
  });
export const BenefitMeterCreditUpdate: ObjectSchema<models.BenefitMeterCreditUpdate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    description: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    visibility: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitVisibility)),
    type: /* @__PURE__ */ z.literal("meter_credit"),
    get properties() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(BenefitMeterCreditCreateProperties),
      );
    },
  });
export const BenefitRevokedEvent: ObjectSchema<models.BenefitRevokedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("benefit.revoked"),
    get metadata() {
      return BenefitGrantMetadata;
    },
  });
export const BenefitSlackSharedChannel: ObjectSchema<models.BenefitSlackSharedChannel> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("slack_shared_channel"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    visibility: BenefitVisibility,
    get properties() {
      return BenefitSlackSharedChannelProperties;
    },
    visibility_configurable: /* @__PURE__ */ z.boolean(),
  });
export const BenefitSlackSharedChannelCreate: ObjectSchema<models.BenefitSlackSharedChannelCreate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    type: /* @__PURE__ */ z.literal("slack_shared_channel"),
    description: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    visibility: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitVisibility)),
    get properties() {
      return BenefitSlackSharedChannelCreateProperties;
    },
  });
export const BenefitSlackSharedChannelCreateProperties: ObjectSchema<models.BenefitSlackSharedChannelCreateProperties> =
  /* @__PURE__ */ z.looseObject({
    slack_integration_id: /* @__PURE__ */ z.string(),
    channel_name_template: /* @__PURE__ */ z.string(),
    private: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    welcome_message: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    archive_on_revoke: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    team_invitees: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
  });
export const BenefitSlackSharedChannelProperties: ObjectSchema<models.BenefitSlackSharedChannelProperties> =
  /* @__PURE__ */ z.looseObject({
    slack_integration_id: /* @__PURE__ */ z.string(),
    channel_name_template: /* @__PURE__ */ z.string(),
    private: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    welcome_message: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    archive_on_revoke: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    team_invitees: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
  });
export const BenefitSlackSharedChannelPublic: ObjectSchema<models.BenefitSlackSharedChannelPublic> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("slack_shared_channel"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
  });
export const BenefitSlackSharedChannelSubscriber: ObjectSchema<models.BenefitSlackSharedChannelSubscriber> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    type: /* @__PURE__ */ z.literal("slack_shared_channel"),
    description: /* @__PURE__ */ z.string(),
    selectable: /* @__PURE__ */ z.boolean(),
    deletable: /* @__PURE__ */ z.boolean(),
    is_deleted: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get organization() {
      return BenefitSubscriberOrganization;
    },
    get properties() {
      return BenefitSlackSharedChannelSubscriberProperties;
    },
  });
export const BenefitSlackSharedChannelSubscriberProperties: ObjectSchema<models.BenefitSlackSharedChannelSubscriberProperties> =
  /* @__PURE__ */ z.looseObject({}) as never;
export const BenefitSlackSharedChannelUpdate: ObjectSchema<models.BenefitSlackSharedChannelUpdate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    description: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    type: /* @__PURE__ */ z.literal("slack_shared_channel"),
    get properties() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(BenefitSlackSharedChannelCreateProperties),
      );
    },
  });
export const BenefitSubscriberOrganization: ObjectSchema<models.BenefitSubscriberOrganization> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    slug: /* @__PURE__ */ z.string(),
    avatar_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    proration_behavior: SubscriptionProrationBehavior,
    allow_customer_updates: /* @__PURE__ */ z.boolean(),
  });
export const BenefitUpdatedEvent: ObjectSchema<models.BenefitUpdatedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("benefit.updated"),
    get metadata() {
      return BenefitGrantMetadata;
    },
  });
export const CannotCreateOrganizationError: ObjectSchema<models.CannotCreateOrganizationError> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("CannotCreateOrganizationError"),
    detail: /* @__PURE__ */ z.string(),
  });
export const CardPayment: ObjectSchema<models.CardPayment> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  processor: PaymentProcessor,
  status: PaymentStatus,
  amount: /* @__PURE__ */ z.int(),
  currency: /* @__PURE__ */ z.string(),
  method: /* @__PURE__ */ z.literal("card"),
  trigger: /* @__PURE__ */ z.nullable(PaymentTrigger),
  decline_reason: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  decline_message: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  organization_id: /* @__PURE__ */ z.string(),
  checkout_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  processor_metadata: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.unknown()),
  ),
  get method_metadata() {
    return CardPaymentMetadata;
  },
});
export const CardPaymentMetadata: ObjectSchema<models.CardPaymentMetadata> =
  /* @__PURE__ */ z.looseObject({
    brand: /* @__PURE__ */ z.string(),
    last4: /* @__PURE__ */ z.string(),
  });
export const Checkout: ObjectSchema<models.Checkout> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  custom_field_data: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.boolean(),
        /* @__PURE__ */ z.null(),
      ]),
    ),
  ),
  payment_processor: PaymentProcessor,
  status: CheckoutStatus,
  client_secret: /* @__PURE__ */ z.string(),
  url: /* @__PURE__ */ z.string(),
  expires_at: /* @__PURE__ */ z.string(),
  success_url: /* @__PURE__ */ z.string(),
  return_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  embed_origin: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  amount: /* @__PURE__ */ z.int(),
  seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  min_seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  max_seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  min_units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  max_units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  discount_amount: /* @__PURE__ */ z.int(),
  net_amount: /* @__PURE__ */ z.int(),
  tax_amount: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  tax_behavior: /* @__PURE__ */ z.nullable(TaxBehavior),
  total_amount: /* @__PURE__ */ z.int(),
  currency: /* @__PURE__ */ z.string(),
  allow_trial: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean()),
  active_trial_interval: /* @__PURE__ */ z.nullable(TrialInterval),
  active_trial_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  trial_end: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  organization_id: /* @__PURE__ */ z.string(),
  product_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  product_price_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  discount_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  allow_discount_codes: /* @__PURE__ */ z.boolean(),
  require_billing_address: /* @__PURE__ */ z.boolean(),
  is_discount_applicable: /* @__PURE__ */ z.boolean(),
  is_free_product_price: /* @__PURE__ */ z.boolean(),
  is_payment_required: /* @__PURE__ */ z.boolean(),
  is_payment_setup_required: /* @__PURE__ */ z.boolean(),
  is_payment_form_required: /* @__PURE__ */ z.boolean(),
  customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  is_business_customer: /* @__PURE__ */ z.boolean(),
  customer_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  customer_email: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  customer_ip_address: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  customer_billing_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get customer_billing_address() {
    return /* @__PURE__ */ z.nullable(Address);
  },
  customer_tax_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  payment_method_type: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  payment_processor_metadata: /* @__PURE__ */ z.record(
    /* @__PURE__ */ z.string(),
    /* @__PURE__ */ z.string(),
  ),
  get billing_address_fields() {
    return CheckoutBillingAddressFields;
  },
  trial_interval: /* @__PURE__ */ z.nullable(TrialInterval),
  trial_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  get metadata() {
    return MetadataOutputType;
  },
  external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get products() {
    return /* @__PURE__ */ z.array(CheckoutProduct);
  },
  get product() {
    return /* @__PURE__ */ z.nullable(CheckoutProduct);
  },
  get product_price() {
    return /* @__PURE__ */ z.nullable(
      /* @__PURE__ */ z.union([LegacyRecurringProductPrice, ProductPrice]),
    );
  },
  get prices() {
    return /* @__PURE__ */ z.nullable(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.array(
          /* @__PURE__ */ z.union([LegacyRecurringProductPrice, ProductPrice]),
        ),
      ),
    );
  },
  get discount() {
    return /* @__PURE__ */ z.nullable(
      /* @__PURE__ */ z.union([
        CheckoutDiscountFixedOnceForeverDuration,
        CheckoutDiscountFixedRepeatDuration,
        CheckoutDiscountPercentageOnceForeverDuration,
        CheckoutDiscountPercentageRepeatDuration,
      ]),
    );
  },
  subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get attached_custom_fields() {
    return /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(AttachedCustomField));
  },
  customer_metadata: /* @__PURE__ */ z.record(
    /* @__PURE__ */ z.string(),
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.boolean(),
    ]),
  ),
});
export const CheckoutBillingAddressFields: ObjectSchema<models.CheckoutBillingAddressFields> =
  /* @__PURE__ */ z.looseObject({
    country: BillingAddressFieldMode,
    state: BillingAddressFieldMode,
    city: BillingAddressFieldMode,
    postal_code: BillingAddressFieldMode,
    line1: BillingAddressFieldMode,
    line2: BillingAddressFieldMode,
  });
export const CheckoutConfirmStripe: ObjectSchema<models.CheckoutConfirmStripe> =
  /* @__PURE__ */ z.looseObject({
    custom_field_data: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.boolean(),
          /* @__PURE__ */ z.null(),
        ]),
      ),
    ),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    units: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    is_business_customer: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean()),
    ),
    customer_name: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    customer_email: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    customer_billing_name: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    get customer_billing_address() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(AddressInput));
    },
    customer_tax_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    payment_method_type: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    discount_code: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    allow_trial: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.literal(false)),
    ),
    confirmation_token_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    product_price_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
  });
export const CheckoutCreate: ObjectSchema<models.CheckoutCreate> = /* @__PURE__ */ z.looseObject({
  trial_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(TrialInterval)),
  trial_interval_count: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  ),
  metadata: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.number(),
        /* @__PURE__ */ z.boolean(),
      ]),
    ),
  ),
  custom_field_data: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.boolean(),
        /* @__PURE__ */ z.null(),
      ]),
    ),
  ),
  discount_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  allow_discount_codes: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
  require_billing_address: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
  amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  min_seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  max_seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  units: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  min_units: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  max_units: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  allow_trial: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
  customer_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  is_business_customer: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
  external_customer_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  customer_name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  customer_email: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  customer_ip_address: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  customer_billing_name: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  get customer_billing_address() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(AddressInput));
  },
  customer_tax_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  customer_metadata: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.number(),
        /* @__PURE__ */ z.boolean(),
      ]),
    ),
  ),
  subscription_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  success_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  return_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  embed_origin: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  currency: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(PresentmentCurrency)),
  products: /* @__PURE__ */ z.array(/* @__PURE__ */ z.string()),
  get prices() {
    return /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(
        /* @__PURE__ */ z.record(
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.array(
            /* @__PURE__ */ z.discriminatedUnion("amount_type", [
              ProductPriceFixedCreate,
              ProductPriceCustomCreate,
              ProductPriceSeatBasedCreate,
              ProductPriceUnitBasedCreate,
              ProductPriceMeteredUnitCreate,
              ProductPriceMeteredTiersCreate,
            ]),
          ),
        ),
      ),
    );
  },
});
export const CheckoutCreatedEvent: ObjectSchema<models.CheckoutCreatedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("checkout.created"),
    get metadata() {
      return CheckoutCreatedMetadata;
    },
  });
export const CheckoutCreatedMetadata: ObjectSchema<models.CheckoutCreatedMetadata> =
  /* @__PURE__ */ z.looseObject({
    checkout_id: /* @__PURE__ */ z.string(),
    checkout_status: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
  });
export const CheckoutDiscountFixedOnceForeverDuration: ObjectSchema<models.CheckoutDiscountFixedOnceForeverDuration> =
  /* @__PURE__ */ z.looseObject({
    duration: DiscountDuration,
    type: DiscountType,
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    amounts: /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.int()),
    id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    code: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const CheckoutDiscountFixedRepeatDuration: ObjectSchema<models.CheckoutDiscountFixedRepeatDuration> =
  /* @__PURE__ */ z.looseObject({
    duration: DiscountDuration,
    duration_in_months: /* @__PURE__ */ z.int(),
    type: DiscountType,
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    amounts: /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.int()),
    id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    code: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const CheckoutDiscountPercentageOnceForeverDuration: ObjectSchema<models.CheckoutDiscountPercentageOnceForeverDuration> =
  /* @__PURE__ */ z.looseObject({
    duration: DiscountDuration,
    type: DiscountType,
    basis_points: /* @__PURE__ */ z.int(),
    id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    code: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const CheckoutDiscountPercentageRepeatDuration: ObjectSchema<models.CheckoutDiscountPercentageRepeatDuration> =
  /* @__PURE__ */ z.looseObject({
    duration: DiscountDuration,
    duration_in_months: /* @__PURE__ */ z.int(),
    type: DiscountType,
    basis_points: /* @__PURE__ */ z.int(),
    id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    code: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const CheckoutLink: ObjectSchema<models.CheckoutLink> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  trial_interval: /* @__PURE__ */ z.nullable(TrialInterval),
  trial_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  get metadata() {
    return MetadataOutputType;
  },
  payment_processor: PaymentProcessor,
  client_secret: /* @__PURE__ */ z.string(),
  success_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  return_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  label: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  allow_discount_codes: /* @__PURE__ */ z.boolean(),
  require_billing_address: /* @__PURE__ */ z.boolean(),
  discount_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  seats: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  organization_id: /* @__PURE__ */ z.string(),
  get products() {
    return /* @__PURE__ */ z.array(CheckoutLinkProduct);
  },
  get discount() {
    return /* @__PURE__ */ z.nullable(
      /* @__PURE__ */ z.union([
        DiscountFixedOnceForeverDurationBase,
        DiscountFixedRepeatDurationBase,
        DiscountPercentageOnceForeverDurationBase,
        DiscountPercentageRepeatDurationBase,
      ]),
    );
  },
  url: /* @__PURE__ */ z.string(),
});
export const CheckoutLinkCreateProduct: ObjectSchema<models.CheckoutLinkCreateProduct> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    trial_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(TrialInterval)),
    trial_interval_count: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
    payment_processor: /* @__PURE__ */ z.literal("stripe"),
    label: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    allow_discount_codes: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    require_billing_address: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    discount_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    units: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    success_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    return_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    product_id: /* @__PURE__ */ z.string(),
  });
export const CheckoutLinkCreateProductPrice: ObjectSchema<models.CheckoutLinkCreateProductPrice> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    trial_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(TrialInterval)),
    trial_interval_count: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
    payment_processor: /* @__PURE__ */ z.literal("stripe"),
    label: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    allow_discount_codes: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    require_billing_address: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    discount_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    units: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    success_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    return_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    product_price_id: /* @__PURE__ */ z.string(),
  });
export const CheckoutLinkCreateProducts: ObjectSchema<models.CheckoutLinkCreateProducts> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    trial_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(TrialInterval)),
    trial_interval_count: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
    payment_processor: /* @__PURE__ */ z.literal("stripe"),
    label: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    allow_discount_codes: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    require_billing_address: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    discount_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    units: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    success_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    return_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    products: /* @__PURE__ */ z.array(/* @__PURE__ */ z.string()),
  });
export const CheckoutLinkProduct: ObjectSchema<models.CheckoutLinkProduct> =
  /* @__PURE__ */ z.looseObject({
    get metadata() {
      return MetadataOutputType;
    },
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    trial_interval: /* @__PURE__ */ z.nullable(TrialInterval),
    trial_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    name: /* @__PURE__ */ z.string(),
    description: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    visibility: ProductVisibility,
    recurring_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
    recurring_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    meter_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
    meter_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    is_recurring: /* @__PURE__ */ z.boolean(),
    is_archived: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get prices() {
      return /* @__PURE__ */ z.array(
        /* @__PURE__ */ z.union([LegacyRecurringProductPrice, ProductPrice]),
      );
    },
    get benefits() {
      return /* @__PURE__ */ z.array(BenefitPublic);
    },
    get medias() {
      return /* @__PURE__ */ z.array(ProductMediaFileRead);
    },
  });
export const CheckoutLinkUpdate: ObjectSchema<models.CheckoutLinkUpdate> =
  /* @__PURE__ */ z.looseObject({
    trial_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(TrialInterval)),
    trial_interval_count: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    products: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
    ),
    label: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    allow_discount_codes: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean()),
    ),
    require_billing_address: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean()),
    ),
    discount_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    units: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    success_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    return_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const CheckoutLocked: ObjectSchema<models.CheckoutLocked> = /* @__PURE__ */ z.looseObject({
  error: /* @__PURE__ */ z.literal("CheckoutLocked"),
  detail: /* @__PURE__ */ z.string(),
});
export const CheckoutOrganization: ObjectSchema<models.CheckoutOrganization> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    slug: /* @__PURE__ */ z.string(),
    avatar_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    proration_behavior: SubscriptionProrationBehavior,
    allow_customer_updates: /* @__PURE__ */ z.boolean(),
  });
export const CheckoutProduct: ObjectSchema<models.CheckoutProduct> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  trial_interval: /* @__PURE__ */ z.nullable(TrialInterval),
  trial_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  name: /* @__PURE__ */ z.string(),
  description: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  visibility: ProductVisibility,
  recurring_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
  recurring_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  meter_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
  meter_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  is_recurring: /* @__PURE__ */ z.boolean(),
  is_archived: /* @__PURE__ */ z.boolean(),
  organization_id: /* @__PURE__ */ z.string(),
  get prices() {
    return /* @__PURE__ */ z.array(
      /* @__PURE__ */ z.union([LegacyRecurringProductPrice, ProductPrice]),
    );
  },
  get benefits() {
    return /* @__PURE__ */ z.array(BenefitPublic);
  },
  get medias() {
    return /* @__PURE__ */ z.array(ProductMediaFileRead);
  },
});
export const CheckoutPublic: ObjectSchema<models.CheckoutPublic> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  custom_field_data: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.boolean(),
        /* @__PURE__ */ z.null(),
      ]),
    ),
  ),
  payment_processor: PaymentProcessor,
  status: CheckoutStatus,
  client_secret: /* @__PURE__ */ z.string(),
  url: /* @__PURE__ */ z.string(),
  expires_at: /* @__PURE__ */ z.string(),
  success_url: /* @__PURE__ */ z.string(),
  return_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  embed_origin: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  amount: /* @__PURE__ */ z.int(),
  seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  min_seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  max_seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  min_units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  max_units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  discount_amount: /* @__PURE__ */ z.int(),
  net_amount: /* @__PURE__ */ z.int(),
  tax_amount: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  tax_behavior: /* @__PURE__ */ z.nullable(TaxBehavior),
  total_amount: /* @__PURE__ */ z.int(),
  currency: /* @__PURE__ */ z.string(),
  allow_trial: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean()),
  active_trial_interval: /* @__PURE__ */ z.nullable(TrialInterval),
  active_trial_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  trial_end: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  organization_id: /* @__PURE__ */ z.string(),
  product_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  product_price_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  discount_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  allow_discount_codes: /* @__PURE__ */ z.boolean(),
  require_billing_address: /* @__PURE__ */ z.boolean(),
  is_discount_applicable: /* @__PURE__ */ z.boolean(),
  is_free_product_price: /* @__PURE__ */ z.boolean(),
  is_payment_required: /* @__PURE__ */ z.boolean(),
  is_payment_setup_required: /* @__PURE__ */ z.boolean(),
  is_payment_form_required: /* @__PURE__ */ z.boolean(),
  customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  is_business_customer: /* @__PURE__ */ z.boolean(),
  customer_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  customer_email: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  customer_ip_address: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  customer_billing_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get customer_billing_address() {
    return /* @__PURE__ */ z.nullable(Address);
  },
  customer_tax_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  payment_method_type: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  payment_processor_metadata: /* @__PURE__ */ z.record(
    /* @__PURE__ */ z.string(),
    /* @__PURE__ */ z.string(),
  ),
  get billing_address_fields() {
    return CheckoutBillingAddressFields;
  },
  get products() {
    return /* @__PURE__ */ z.array(CheckoutProduct);
  },
  get product() {
    return /* @__PURE__ */ z.nullable(CheckoutProduct);
  },
  get product_price() {
    return /* @__PURE__ */ z.nullable(
      /* @__PURE__ */ z.union([LegacyRecurringProductPrice, ProductPrice]),
    );
  },
  get prices() {
    return /* @__PURE__ */ z.nullable(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.array(
          /* @__PURE__ */ z.union([LegacyRecurringProductPrice, ProductPrice]),
        ),
      ),
    );
  },
  get discount() {
    return /* @__PURE__ */ z.nullable(
      /* @__PURE__ */ z.union([
        CheckoutDiscountFixedOnceForeverDuration,
        CheckoutDiscountFixedRepeatDuration,
        CheckoutDiscountPercentageOnceForeverDuration,
        CheckoutDiscountPercentageRepeatDuration,
      ]),
    );
  },
  get organization() {
    return CheckoutOrganization;
  },
  get attached_custom_fields() {
    return /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(AttachedCustomField));
  },
});
export const CheckoutPublicConfirmed: ObjectSchema<models.CheckoutPublicConfirmed> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    custom_field_data: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.boolean(),
          /* @__PURE__ */ z.null(),
        ]),
      ),
    ),
    payment_processor: PaymentProcessor,
    status: /* @__PURE__ */ z.literal("confirmed"),
    client_secret: /* @__PURE__ */ z.string(),
    url: /* @__PURE__ */ z.string(),
    expires_at: /* @__PURE__ */ z.string(),
    success_url: /* @__PURE__ */ z.string(),
    return_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    embed_origin: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    amount: /* @__PURE__ */ z.int(),
    seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    min_seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    max_seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    min_units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    max_units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    discount_amount: /* @__PURE__ */ z.int(),
    net_amount: /* @__PURE__ */ z.int(),
    tax_amount: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    tax_behavior: /* @__PURE__ */ z.nullable(TaxBehavior),
    total_amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    allow_trial: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean()),
    active_trial_interval: /* @__PURE__ */ z.nullable(TrialInterval),
    active_trial_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    trial_end: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    organization_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    product_price_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    discount_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    allow_discount_codes: /* @__PURE__ */ z.boolean(),
    require_billing_address: /* @__PURE__ */ z.boolean(),
    is_discount_applicable: /* @__PURE__ */ z.boolean(),
    is_free_product_price: /* @__PURE__ */ z.boolean(),
    is_payment_required: /* @__PURE__ */ z.boolean(),
    is_payment_setup_required: /* @__PURE__ */ z.boolean(),
    is_payment_form_required: /* @__PURE__ */ z.boolean(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    is_business_customer: /* @__PURE__ */ z.boolean(),
    customer_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_email: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_ip_address: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_billing_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer_billing_address() {
      return /* @__PURE__ */ z.nullable(Address);
    },
    customer_tax_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    payment_method_type: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    payment_processor_metadata: /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.string(),
    ),
    get billing_address_fields() {
      return CheckoutBillingAddressFields;
    },
    get products() {
      return /* @__PURE__ */ z.array(CheckoutProduct);
    },
    get product() {
      return /* @__PURE__ */ z.nullable(CheckoutProduct);
    },
    get product_price() {
      return /* @__PURE__ */ z.nullable(
        /* @__PURE__ */ z.union([LegacyRecurringProductPrice, ProductPrice]),
      );
    },
    get prices() {
      return /* @__PURE__ */ z.nullable(
        /* @__PURE__ */ z.record(
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.array(
            /* @__PURE__ */ z.union([LegacyRecurringProductPrice, ProductPrice]),
          ),
        ),
      );
    },
    get discount() {
      return /* @__PURE__ */ z.nullable(
        /* @__PURE__ */ z.union([
          CheckoutDiscountFixedOnceForeverDuration,
          CheckoutDiscountFixedRepeatDuration,
          CheckoutDiscountPercentageOnceForeverDuration,
          CheckoutDiscountPercentageRepeatDuration,
        ]),
      );
    },
    get organization() {
      return CheckoutOrganization;
    },
    get attached_custom_fields() {
      return /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(AttachedCustomField));
    },
    customer_session_token: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const CheckoutUpdate: ObjectSchema<models.CheckoutUpdate> = /* @__PURE__ */ z.looseObject({
  custom_field_data: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.boolean(),
        /* @__PURE__ */ z.null(),
      ]),
    ),
  ),
  product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  units: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  is_business_customer: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean()),
  ),
  customer_name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  customer_email: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  customer_billing_name: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  get customer_billing_address() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(AddressInput));
  },
  customer_tax_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  trial_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(TrialInterval)),
  trial_interval_count: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  ),
  metadata: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.number(),
        /* @__PURE__ */ z.boolean(),
      ]),
    ),
  ),
  currency: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(PresentmentCurrency)),
  discount_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  allow_discount_codes: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean()),
  ),
  require_billing_address: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean()),
  ),
  allow_trial: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean())),
  customer_ip_address: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  customer_metadata: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
  ),
  success_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  return_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  embed_origin: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  product_price_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
});
export const CheckoutUpdatePublic: ObjectSchema<models.CheckoutUpdatePublic> =
  /* @__PURE__ */ z.looseObject({
    custom_field_data: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.boolean(),
          /* @__PURE__ */ z.null(),
        ]),
      ),
    ),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    units: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    is_business_customer: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean()),
    ),
    customer_name: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    customer_email: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    customer_billing_name: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    get customer_billing_address() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(AddressInput));
    },
    customer_tax_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    payment_method_type: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    discount_code: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    allow_trial: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.literal(false)),
    ),
    product_price_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
  });
export const Context: ObjectSchema<models.Context> = /* @__PURE__ */ z.looseObject({}) as never;
export const CostMetadataInput: ObjectSchema<models.CostMetadataInput> =
  /* @__PURE__ */ z.looseObject({
    amount: /* @__PURE__ */ z.union([/* @__PURE__ */ z.number(), /* @__PURE__ */ z.string()]),
    currency: /* @__PURE__ */ z.string(),
  });
export const CostMetadataOutput: ObjectSchema<models.CostMetadataOutput> =
  /* @__PURE__ */ z.looseObject({
    amount: /* @__PURE__ */ z.string(),
    currency: /* @__PURE__ */ z.string(),
  });
export const CountAggregation: ObjectSchema<models.CountAggregation> =
  /* @__PURE__ */ z.looseObject({
    func: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.literal("count")),
  });
export const CursorPagination: ObjectSchema<models.CursorPagination> =
  /* @__PURE__ */ z.looseObject({ has_next_page: /* @__PURE__ */ z.boolean() });
export const CustomFieldCheckbox: ObjectSchema<models.CustomFieldCheckbox> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    type: /* @__PURE__ */ z.literal("checkbox"),
    slug: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    get properties() {
      return CustomFieldCheckboxProperties;
    },
  });
export const CustomFieldCheckboxProperties: ObjectSchema<models.CustomFieldCheckboxProperties> =
  /* @__PURE__ */ z.looseObject({
    form_label: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    form_help_text: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    form_placeholder: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
  });
export const CustomFieldCreateCheckbox: ObjectSchema<models.CustomFieldCreateCheckbox> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    type: /* @__PURE__ */ z.literal("checkbox"),
    slug: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    get properties() {
      return CustomFieldCheckboxProperties;
    },
  });
export const CustomFieldCreateDate: ObjectSchema<models.CustomFieldCreateDate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    type: /* @__PURE__ */ z.literal("date"),
    slug: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    get properties() {
      return CustomFieldDateProperties;
    },
  });
export const CustomFieldCreateNumber: ObjectSchema<models.CustomFieldCreateNumber> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    type: /* @__PURE__ */ z.literal("number"),
    slug: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    get properties() {
      return CustomFieldNumberProperties;
    },
  });
export const CustomFieldCreateSelect: ObjectSchema<models.CustomFieldCreateSelect> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    type: /* @__PURE__ */ z.literal("select"),
    slug: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    get properties() {
      return CustomFieldSelectProperties;
    },
  });
export const CustomFieldCreateText: ObjectSchema<models.CustomFieldCreateText> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    type: /* @__PURE__ */ z.literal("text"),
    slug: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    get properties() {
      return CustomFieldTextProperties;
    },
  });
export const CustomFieldDate: ObjectSchema<models.CustomFieldDate> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  get metadata() {
    return MetadataOutputType;
  },
  type: /* @__PURE__ */ z.literal("date"),
  slug: /* @__PURE__ */ z.string(),
  name: /* @__PURE__ */ z.string(),
  organization_id: /* @__PURE__ */ z.string(),
  get properties() {
    return CustomFieldDateProperties;
  },
});
export const CustomFieldDateProperties: ObjectSchema<models.CustomFieldDateProperties> =
  /* @__PURE__ */ z.looseObject({
    form_label: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    form_help_text: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    form_placeholder: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    ge: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    le: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
  });
export const CustomFieldNumber: ObjectSchema<models.CustomFieldNumber> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    type: /* @__PURE__ */ z.literal("number"),
    slug: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    get properties() {
      return CustomFieldNumberProperties;
    },
  });
export const CustomFieldNumberProperties: ObjectSchema<models.CustomFieldNumberProperties> =
  /* @__PURE__ */ z.looseObject({
    form_label: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    form_help_text: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    form_placeholder: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    ge: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    le: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
  });
export const CustomFieldSelect: ObjectSchema<models.CustomFieldSelect> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    type: /* @__PURE__ */ z.literal("select"),
    slug: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    get properties() {
      return CustomFieldSelectProperties;
    },
  });
export const CustomFieldSelectOption: ObjectSchema<models.CustomFieldSelectOption> =
  /* @__PURE__ */ z.looseObject({
    value: /* @__PURE__ */ z.string(),
    label: /* @__PURE__ */ z.string(),
  });
export const CustomFieldSelectProperties: ObjectSchema<models.CustomFieldSelectProperties> =
  /* @__PURE__ */ z.looseObject({
    form_label: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    form_help_text: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    form_placeholder: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    get options() {
      return /* @__PURE__ */ z.array(CustomFieldSelectOption);
    },
  });
export const CustomFieldText: ObjectSchema<models.CustomFieldText> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  get metadata() {
    return MetadataOutputType;
  },
  type: /* @__PURE__ */ z.literal("text"),
  slug: /* @__PURE__ */ z.string(),
  name: /* @__PURE__ */ z.string(),
  organization_id: /* @__PURE__ */ z.string(),
  get properties() {
    return CustomFieldTextProperties;
  },
});
export const CustomFieldTextProperties: ObjectSchema<models.CustomFieldTextProperties> =
  /* @__PURE__ */ z.looseObject({
    form_label: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    form_help_text: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    form_placeholder: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    textarea: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    min_length: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    max_length: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
  });
export const CustomFieldUpdateCheckbox: ObjectSchema<models.CustomFieldUpdateCheckbox> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    slug: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    type: /* @__PURE__ */ z.literal("checkbox"),
    get properties() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(CustomFieldCheckboxProperties));
    },
  });
export const CustomFieldUpdateDate: ObjectSchema<models.CustomFieldUpdateDate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    slug: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    type: /* @__PURE__ */ z.literal("date"),
    get properties() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(CustomFieldDateProperties));
    },
  });
export const CustomFieldUpdateNumber: ObjectSchema<models.CustomFieldUpdateNumber> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    slug: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    type: /* @__PURE__ */ z.literal("number"),
    get properties() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(CustomFieldNumberProperties));
    },
  });
export const CustomFieldUpdateSelect: ObjectSchema<models.CustomFieldUpdateSelect> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    slug: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    type: /* @__PURE__ */ z.literal("select"),
    get properties() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(CustomFieldSelectProperties));
    },
  });
export const CustomFieldUpdateText: ObjectSchema<models.CustomFieldUpdateText> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    slug: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    type: /* @__PURE__ */ z.literal("text"),
    get properties() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(CustomFieldTextProperties));
    },
  });
export const CustomerBenefitGrantCustom: ObjectSchema<models.CustomerBenefitGrantCustom> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    revoked_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    is_granted: /* @__PURE__ */ z.boolean(),
    is_revoked: /* @__PURE__ */ z.boolean(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return CustomerPortalCustomer;
    },
    get benefit() {
      return BenefitCustomSubscriber;
    },
    get properties() {
      return BenefitGrantCustomProperties;
    },
  });
export const CustomerBenefitGrantCustomUpdate: ObjectSchema<models.CustomerBenefitGrantCustomUpdate> =
  /* @__PURE__ */ z.looseObject({ benefit_type: /* @__PURE__ */ z.literal("custom") });
export const CustomerBenefitGrantDiscord: ObjectSchema<models.CustomerBenefitGrantDiscord> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    revoked_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    is_granted: /* @__PURE__ */ z.boolean(),
    is_revoked: /* @__PURE__ */ z.boolean(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return CustomerPortalCustomer;
    },
    get member() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(CustomerBenefitGrantMember));
    },
    get benefit() {
      return BenefitDiscordSubscriber;
    },
    get properties() {
      return BenefitGrantDiscordProperties;
    },
  });
export const CustomerBenefitGrantDiscordPropertiesUpdate: ObjectSchema<models.CustomerBenefitGrantDiscordPropertiesUpdate> =
  /* @__PURE__ */ z.looseObject({
    account_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const CustomerBenefitGrantDiscordUpdate: ObjectSchema<models.CustomerBenefitGrantDiscordUpdate> =
  /* @__PURE__ */ z.looseObject({
    benefit_type: /* @__PURE__ */ z.literal("discord"),
    get properties() {
      return CustomerBenefitGrantDiscordPropertiesUpdate;
    },
  });
export const CustomerBenefitGrantDownloadables: ObjectSchema<models.CustomerBenefitGrantDownloadables> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    revoked_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    is_granted: /* @__PURE__ */ z.boolean(),
    is_revoked: /* @__PURE__ */ z.boolean(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return CustomerPortalCustomer;
    },
    get benefit() {
      return BenefitDownloadablesSubscriber;
    },
    get properties() {
      return BenefitGrantDownloadablesProperties;
    },
  });
export const CustomerBenefitGrantDownloadablesUpdate: ObjectSchema<models.CustomerBenefitGrantDownloadablesUpdate> =
  /* @__PURE__ */ z.looseObject({ benefit_type: /* @__PURE__ */ z.literal("downloadables") });
export const CustomerBenefitGrantFeatureFlag: ObjectSchema<models.CustomerBenefitGrantFeatureFlag> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    revoked_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    is_granted: /* @__PURE__ */ z.boolean(),
    is_revoked: /* @__PURE__ */ z.boolean(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return CustomerPortalCustomer;
    },
    get benefit() {
      return BenefitFeatureFlagSubscriber;
    },
    get properties() {
      return BenefitGrantFeatureFlagProperties;
    },
  });
export const CustomerBenefitGrantFeatureFlagUpdate: ObjectSchema<models.CustomerBenefitGrantFeatureFlagUpdate> =
  /* @__PURE__ */ z.looseObject({ benefit_type: /* @__PURE__ */ z.literal("feature_flag") });
export const CustomerBenefitGrantGitHubRepository: ObjectSchema<models.CustomerBenefitGrantGitHubRepository> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    revoked_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    is_granted: /* @__PURE__ */ z.boolean(),
    is_revoked: /* @__PURE__ */ z.boolean(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return CustomerPortalCustomer;
    },
    get member() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(CustomerBenefitGrantMember));
    },
    get benefit() {
      return BenefitGitHubRepositorySubscriber;
    },
    get properties() {
      return BenefitGrantGitHubRepositoryProperties;
    },
  });
export const CustomerBenefitGrantGitHubRepositoryPropertiesUpdate: ObjectSchema<models.CustomerBenefitGrantGitHubRepositoryPropertiesUpdate> =
  /* @__PURE__ */ z.looseObject({
    account_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const CustomerBenefitGrantGitHubRepositoryUpdate: ObjectSchema<models.CustomerBenefitGrantGitHubRepositoryUpdate> =
  /* @__PURE__ */ z.looseObject({
    benefit_type: /* @__PURE__ */ z.literal("github_repository"),
    get properties() {
      return CustomerBenefitGrantGitHubRepositoryPropertiesUpdate;
    },
  });
export const CustomerBenefitGrantLicenseKeys: ObjectSchema<models.CustomerBenefitGrantLicenseKeys> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    revoked_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    is_granted: /* @__PURE__ */ z.boolean(),
    is_revoked: /* @__PURE__ */ z.boolean(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return CustomerPortalCustomer;
    },
    get benefit() {
      return BenefitLicenseKeysSubscriber;
    },
    get properties() {
      return BenefitGrantLicenseKeysProperties;
    },
  });
export const CustomerBenefitGrantLicenseKeysUpdate: ObjectSchema<models.CustomerBenefitGrantLicenseKeysUpdate> =
  /* @__PURE__ */ z.looseObject({ benefit_type: /* @__PURE__ */ z.literal("license_keys") });
export const CustomerBenefitGrantMember: ObjectSchema<models.CustomerBenefitGrantMember> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    get oauth_accounts() {
      return /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), CustomerPortalOAuthAccount);
    },
  });
export const CustomerBenefitGrantMeterCredit: ObjectSchema<models.CustomerBenefitGrantMeterCredit> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    revoked_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    is_granted: /* @__PURE__ */ z.boolean(),
    is_revoked: /* @__PURE__ */ z.boolean(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return CustomerPortalCustomer;
    },
    get benefit() {
      return BenefitMeterCreditSubscriber;
    },
    get properties() {
      return BenefitGrantMeterCreditProperties;
    },
  });
export const CustomerBenefitGrantMeterCreditUpdate: ObjectSchema<models.CustomerBenefitGrantMeterCreditUpdate> =
  /* @__PURE__ */ z.looseObject({ benefit_type: /* @__PURE__ */ z.literal("meter_credit") });
export const CustomerBenefitGrantSlackSharedChannel: ObjectSchema<models.CustomerBenefitGrantSlackSharedChannel> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    granted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    revoked_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    benefit_id: /* @__PURE__ */ z.string(),
    subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    is_granted: /* @__PURE__ */ z.boolean(),
    is_revoked: /* @__PURE__ */ z.boolean(),
    get error() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(BenefitGrantError));
    },
    get customer() {
      return CustomerPortalCustomer;
    },
    get benefit() {
      return BenefitSlackSharedChannelSubscriber;
    },
    get properties() {
      return BenefitGrantSlackSharedChannelProperties;
    },
  });
export const CustomerBenefitGrantSlackSharedChannelPropertiesUpdate: ObjectSchema<models.CustomerBenefitGrantSlackSharedChannelPropertiesUpdate> =
  /* @__PURE__ */ z.looseObject({ invited_email: /* @__PURE__ */ z.string() });
export const CustomerBenefitGrantSlackSharedChannelUpdate: ObjectSchema<models.CustomerBenefitGrantSlackSharedChannelUpdate> =
  /* @__PURE__ */ z.looseObject({
    benefit_type: /* @__PURE__ */ z.literal("slack_shared_channel"),
    get properties() {
      return CustomerBenefitGrantSlackSharedChannelPropertiesUpdate;
    },
  });
export const CustomerCreatedEvent: ObjectSchema<models.CustomerCreatedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("customer.created"),
    get metadata() {
      return CustomerCreatedMetadata;
    },
  });
export const CustomerCreatedMetadata: ObjectSchema<models.CustomerCreatedMetadata> =
  /* @__PURE__ */ z.looseObject({
    customer_id: /* @__PURE__ */ z.string(),
    customer_email: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_external_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const CustomerCustomerMeter: ObjectSchema<models.CustomerCustomerMeter> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    meter_id: /* @__PURE__ */ z.string(),
    consumed_units: /* @__PURE__ */ z.number(),
    credited_units: /* @__PURE__ */ z.int(),
    balance: /* @__PURE__ */ z.number(),
    get meter() {
      return CustomerCustomerMeterMeter;
    },
  });
export const CustomerCustomerMeterMeter: ObjectSchema<models.CustomerCustomerMeterMeter> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
  });
export const CustomerCustomerSession: ObjectSchema<models.CustomerCustomerSession> =
  /* @__PURE__ */ z.looseObject({
    expires_at: /* @__PURE__ */ z.string(),
    return_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const CustomerDeletedEvent: ObjectSchema<models.CustomerDeletedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("customer.deleted"),
    get metadata() {
      return CustomerDeletedMetadata;
    },
  });
export const CustomerDeletedMetadata: ObjectSchema<models.CustomerDeletedMetadata> =
  /* @__PURE__ */ z.looseObject({
    customer_id: /* @__PURE__ */ z.string(),
    customer_email: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_external_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const CustomerEmailUpdateRequest: ObjectSchema<models.CustomerEmailUpdateRequest> =
  /* @__PURE__ */ z.looseObject({ email: /* @__PURE__ */ z.string() });
export const CustomerEmailUpdateVerifyRequest: ObjectSchema<models.CustomerEmailUpdateVerifyRequest> =
  /* @__PURE__ */ z.looseObject({ token: /* @__PURE__ */ z.string() });
export const CustomerEmailUpdateVerifyResponse: ObjectSchema<models.CustomerEmailUpdateVerifyResponse> =
  /* @__PURE__ */ z.looseObject({ token: /* @__PURE__ */ z.string() });
export const CustomerIndividual: ObjectSchema<models.CustomerIndividual> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get metadata() {
      return MetadataOutputType;
    },
    external_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    email: /* @__PURE__ */ z.string(),
    email_verified: /* @__PURE__ */ z.boolean(),
    type: /* @__PURE__ */ z.literal("individual"),
    name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    billing_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get billing_address() {
      return /* @__PURE__ */ z.nullable(Address);
    },
    tax_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.unknown())),
    locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    organization_id: /* @__PURE__ */ z.string(),
    default_payment_method_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    deleted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    first_user_event_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    avatar_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const CustomerIndividualCreate: ObjectSchema<models.CustomerIndividualCreate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    external_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    get billing_address() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(AddressInput));
    },
    tax_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    get owner() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(MemberOwnerCreate));
    },
    type: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.literal("individual")),
    email: /* @__PURE__ */ z.string(),
  });
export const CustomerMeter: ObjectSchema<models.CustomerMeter> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  customer_id: /* @__PURE__ */ z.string(),
  meter_id: /* @__PURE__ */ z.string(),
  consumed_units: /* @__PURE__ */ z.number(),
  credited_units: /* @__PURE__ */ z.int(),
  balance: /* @__PURE__ */ z.number(),
  get customer() {
    return Customer;
  },
  get meter() {
    return Meter;
  },
});
export const CustomerNotReady: ObjectSchema<models.CustomerNotReady> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("CustomerNotReady"),
    detail: /* @__PURE__ */ z.string(),
  });
export const CustomerOrder: ObjectSchema<models.CustomerOrder> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  status: OrderStatus,
  paid: /* @__PURE__ */ z.boolean(),
  subtotal_amount: /* @__PURE__ */ z.int(),
  discount_amount: /* @__PURE__ */ z.int(),
  net_amount: /* @__PURE__ */ z.int(),
  tax_amount: /* @__PURE__ */ z.int(),
  total_amount: /* @__PURE__ */ z.int(),
  applied_balance_amount: /* @__PURE__ */ z.int(),
  due_amount: /* @__PURE__ */ z.int(),
  refunded_amount: /* @__PURE__ */ z.int(),
  refunded_tax_amount: /* @__PURE__ */ z.int(),
  currency: /* @__PURE__ */ z.string(),
  billing_reason: OrderBillingReason,
  billing_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get billing_address() {
    return /* @__PURE__ */ z.nullable(Address);
  },
  invoice_number: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  is_invoice_generated: /* @__PURE__ */ z.boolean(),
  receipt_number: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  customer_id: /* @__PURE__ */ z.string(),
  product_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  discount_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  checkout_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  next_payment_attempt_at: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  get product() {
    return /* @__PURE__ */ z.nullable(CustomerOrderProduct);
  },
  get subscription() {
    return /* @__PURE__ */ z.nullable(CustomerOrderSubscription);
  },
  get items() {
    return /* @__PURE__ */ z.array(OrderItemSchema);
  },
  description: /* @__PURE__ */ z.string(),
  refundable_amount: /* @__PURE__ */ z.int(),
  refundable_tax_amount: /* @__PURE__ */ z.int(),
});
export const CustomerOrderConfirmPayment: ObjectSchema<models.CustomerOrderConfirmPayment> =
  /* @__PURE__ */ z.looseObject({
    confirmation_token_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    payment_method_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    payment_processor: /* @__PURE__ */ z.optional(PaymentProcessor),
  });
export const CustomerOrderInvoice: ObjectSchema<models.CustomerOrderInvoice> =
  /* @__PURE__ */ z.looseObject({ url: /* @__PURE__ */ z.string() });
export const CustomerOrderPaymentConfirmation: ObjectSchema<models.CustomerOrderPaymentConfirmation> =
  /* @__PURE__ */ z.looseObject({
    status: /* @__PURE__ */ z.string(),
    client_secret: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    error: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const CustomerOrderPaymentStatus: ObjectSchema<models.CustomerOrderPaymentStatus> =
  /* @__PURE__ */ z.looseObject({
    status: /* @__PURE__ */ z.string(),
    error: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const CustomerOrderProduct: ObjectSchema<models.CustomerOrderProduct> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    trial_interval: /* @__PURE__ */ z.nullable(TrialInterval),
    trial_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    name: /* @__PURE__ */ z.string(),
    description: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    visibility: ProductVisibility,
    recurring_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
    recurring_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    meter_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
    meter_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    is_recurring: /* @__PURE__ */ z.boolean(),
    is_archived: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get prices() {
      return /* @__PURE__ */ z.array(
        /* @__PURE__ */ z.union([LegacyRecurringProductPrice, ProductPrice]),
      );
    },
    get benefits() {
      return /* @__PURE__ */ z.array(BenefitPublic);
    },
    get medias() {
      return /* @__PURE__ */ z.array(ProductMediaFileRead);
    },
    get organization() {
      return CustomerOrganization;
    },
  });
export const CustomerOrderReceipt: ObjectSchema<models.CustomerOrderReceipt> =
  /* @__PURE__ */ z.looseObject({ url: /* @__PURE__ */ z.string() });
export const CustomerOrderSubscription: ObjectSchema<models.CustomerOrderSubscription> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    recurring_interval: RecurringInterval,
    recurring_interval_count: /* @__PURE__ */ z.int(),
    status: SubscriptionStatus,
    current_period_start: /* @__PURE__ */ z.string(),
    current_period_end: /* @__PURE__ */ z.string(),
    current_meter_period_start: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    current_meter_period_end: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    trial_start: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    trial_end: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    cancel_at_period_end: /* @__PURE__ */ z.boolean(),
    canceled_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    started_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ends_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ended_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    past_due_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    pause_at_period_end: /* @__PURE__ */ z.boolean(),
    paused_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    resumes_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.string(),
    discount_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checkout_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    customer_cancellation_reason: /* @__PURE__ */ z.nullable(CustomerCancellationReason),
    customer_cancellation_comment: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const CustomerOrderUpdate: ObjectSchema<models.CustomerOrderUpdate> =
  /* @__PURE__ */ z.looseObject({
    billing_name: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    get billing_address() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(AddressInput));
    },
  });
export const CustomerOrganization: ObjectSchema<models.CustomerOrganization> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    slug: /* @__PURE__ */ z.string(),
    avatar_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    proration_behavior: SubscriptionProrationBehavior,
    allow_customer_updates: /* @__PURE__ */ z.boolean(),
    get customer_portal_settings() {
      return OrganizationCustomerPortalSettings;
    },
    get organization_features() {
      return /* @__PURE__ */ z.optional(CustomerOrganizationFeatureSettings);
    },
  });
export const CustomerOrganizationData: ObjectSchema<models.CustomerOrganizationData> =
  /* @__PURE__ */ z.looseObject({
    get organization() {
      return CustomerOrganization;
    },
    get products() {
      return /* @__PURE__ */ z.array(CustomerProduct);
    },
  });
export const CustomerOrganizationFeatureSettings: ObjectSchema<models.CustomerOrganizationFeatureSettings> =
  /* @__PURE__ */ z.looseObject({
    member_model_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    checkout_localization_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
  });
export const CustomerPaymentMethodCard: ObjectSchema<models.CustomerPaymentMethodCard> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    processor: PaymentProcessor,
    customer_id: /* @__PURE__ */ z.string(),
    type: /* @__PURE__ */ z.literal("card"),
    get method_metadata() {
      return PaymentMethodCardMetadata;
    },
    is_default: /* @__PURE__ */ z.boolean(),
  });
export const CustomerPaymentMethodConfirm: ObjectSchema<models.CustomerPaymentMethodConfirm> =
  /* @__PURE__ */ z.looseObject({
    setup_intent_id: /* @__PURE__ */ z.string(),
    set_default: /* @__PURE__ */ z.boolean(),
  });
export const CustomerPaymentMethodCreate: ObjectSchema<models.CustomerPaymentMethodCreate> =
  /* @__PURE__ */ z.looseObject({
    confirmation_token_id: /* @__PURE__ */ z.string(),
    set_default: /* @__PURE__ */ z.boolean(),
    return_url: /* @__PURE__ */ z.string(),
  });
export const CustomerPaymentMethodCreateRequiresActionResponse: ObjectSchema<models.CustomerPaymentMethodCreateRequiresActionResponse> =
  /* @__PURE__ */ z.looseObject({
    status: /* @__PURE__ */ z.literal("requires_action"),
    client_secret: /* @__PURE__ */ z.string(),
  });
export const CustomerPaymentMethodCreateSucceededResponse: ObjectSchema<models.CustomerPaymentMethodCreateSucceededResponse> =
  /* @__PURE__ */ z.looseObject({
    status: /* @__PURE__ */ z.literal("succeeded"),
    get payment_method() {
      return CustomerPaymentMethod;
    },
  });
export const CustomerPaymentMethodGeneric: ObjectSchema<models.CustomerPaymentMethodGeneric> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    processor: PaymentProcessor,
    customer_id: /* @__PURE__ */ z.string(),
    type: /* @__PURE__ */ z.string(),
    is_default: /* @__PURE__ */ z.boolean(),
  });
export const CustomerPaymentMethodKrCard: ObjectSchema<models.CustomerPaymentMethodKrCard> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    processor: PaymentProcessor,
    customer_id: /* @__PURE__ */ z.string(),
    type: /* @__PURE__ */ z.literal("kr_card"),
    get method_metadata() {
      return PaymentMethodKrCardMetadata;
    },
    is_default: /* @__PURE__ */ z.boolean(),
  });
export const CustomerPortalCustomer: ObjectSchema<models.CustomerPortalCustomer> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    email: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    email_verified: /* @__PURE__ */ z.boolean(),
    name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    billing_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get billing_address() {
      return /* @__PURE__ */ z.nullable(Address);
    },
    tax_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.unknown())),
    get oauth_accounts() {
      return /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), CustomerPortalOAuthAccount);
    },
    default_payment_method_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    type: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(CustomerType)),
    locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const CustomerPortalCustomerSettings: ObjectSchema<models.CustomerPortalCustomerSettings> =
  /* @__PURE__ */ z.looseObject({
    allow_email_change: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
  });
export const CustomerPortalCustomerUpdate: ObjectSchema<models.CustomerPortalCustomerUpdate> =
  /* @__PURE__ */ z.looseObject({
    billing_name: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    get billing_address() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(AddressInput));
    },
    tax_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    default_payment_method_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
  });
export const CustomerPortalMember: ObjectSchema<models.CustomerPortalMember> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    email: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    role: MemberRole,
  });
export const CustomerPortalMemberCreate: ObjectSchema<models.CustomerPortalMemberCreate> =
  /* @__PURE__ */ z.looseObject({
    email: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    role: /* @__PURE__ */ z.optional(MemberRole),
  });
export const CustomerPortalMemberUpdate: ObjectSchema<models.CustomerPortalMemberUpdate> =
  /* @__PURE__ */ z.looseObject({
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    role: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(MemberRole)),
  });
export const CustomerPortalOAuthAccount: ObjectSchema<models.CustomerPortalOAuthAccount> =
  /* @__PURE__ */ z.looseObject({
    account_id: /* @__PURE__ */ z.string(),
    account_username: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const CustomerPortalSubscriptionSettings: ObjectSchema<models.CustomerPortalSubscriptionSettings> =
  /* @__PURE__ */ z.looseObject({
    update_seats: /* @__PURE__ */ z.boolean(),
    update_plan: /* @__PURE__ */ z.boolean(),
    update_units: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    pause: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
  });
export const CustomerPortalUsageSettings: ObjectSchema<models.CustomerPortalUsageSettings> =
  /* @__PURE__ */ z.looseObject({ show: /* @__PURE__ */ z.boolean() });
export const CustomerProduct: ObjectSchema<models.CustomerProduct> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  trial_interval: /* @__PURE__ */ z.nullable(TrialInterval),
  trial_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  name: /* @__PURE__ */ z.string(),
  description: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  visibility: ProductVisibility,
  recurring_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
  recurring_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  meter_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
  meter_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  is_recurring: /* @__PURE__ */ z.boolean(),
  is_archived: /* @__PURE__ */ z.boolean(),
  organization_id: /* @__PURE__ */ z.string(),
  get prices() {
    return /* @__PURE__ */ z.array(
      /* @__PURE__ */ z.union([LegacyRecurringProductPrice, ProductPrice]),
    );
  },
  get benefits() {
    return /* @__PURE__ */ z.array(BenefitPublic);
  },
  get medias() {
    return /* @__PURE__ */ z.array(ProductMediaFileRead);
  },
});
export const CustomerSeat: ObjectSchema<models.CustomerSeat> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  status: SeatStatus,
  customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  member_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get member() {
    return /* @__PURE__ */ z.nullable(Member);
  },
  email: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  customer_email: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  invitation_token_expires_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  claimed_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  revoked_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  seat_metadata: /* @__PURE__ */ z.nullable(
    /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.unknown()),
  ),
});
export const CustomerSeatAssign: ObjectSchema<models.CustomerSeatAssign> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    order_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_customer_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    customer_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(
        /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.unknown()),
      ),
    ),
    immediate_claim: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    checkout_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const CustomerSeatClaimResponse: ObjectSchema<models.CustomerSeatClaimResponse> =
  /* @__PURE__ */ z.looseObject({
    get seat() {
      return CustomerSeat;
    },
    customer_session_token: /* @__PURE__ */ z.string(),
  });
export const CustomerSession: ObjectSchema<models.CustomerSession> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  token: /* @__PURE__ */ z.string(),
  expires_at: /* @__PURE__ */ z.string(),
  return_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  customer_portal_url: /* @__PURE__ */ z.string(),
  customer_id: /* @__PURE__ */ z.string(),
  get customer() {
    return Customer;
  },
});
export const CustomerSessionCustomerExternalIDCreate: ObjectSchema<models.CustomerSessionCustomerExternalIDCreate> =
  /* @__PURE__ */ z.looseObject({
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    return_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_customer_id: /* @__PURE__ */ z.string(),
  });
export const CustomerSessionCustomerIDCreate: ObjectSchema<models.CustomerSessionCustomerIDCreate> =
  /* @__PURE__ */ z.looseObject({
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    return_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    customer_id: /* @__PURE__ */ z.string(),
  });
export const CustomerStateBenefitGrant: ObjectSchema<models.CustomerStateBenefitGrant> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    granted_at: /* @__PURE__ */ z.string(),
    benefit_id: /* @__PURE__ */ z.string(),
    benefit_type: BenefitType,
    get benefit_metadata() {
      return MetadataOutputType;
    },
    get properties() {
      return /* @__PURE__ */ z.union([
        BenefitGrantDiscordProperties,
        BenefitGrantGitHubRepositoryProperties,
        BenefitGrantDownloadablesProperties,
        BenefitGrantLicenseKeysProperties,
        BenefitGrantCustomProperties,
        BenefitGrantFeatureFlagProperties,
        BenefitGrantSlackSharedChannelProperties,
      ]);
    },
  });
export const CustomerStateIndividual: ObjectSchema<models.CustomerStateIndividual> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get metadata() {
      return MetadataOutputType;
    },
    external_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    email: /* @__PURE__ */ z.string(),
    email_verified: /* @__PURE__ */ z.boolean(),
    type: /* @__PURE__ */ z.literal("individual"),
    name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    billing_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get billing_address() {
      return /* @__PURE__ */ z.nullable(Address);
    },
    tax_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.unknown())),
    locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    organization_id: /* @__PURE__ */ z.string(),
    default_payment_method_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    deleted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    first_user_event_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    avatar_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get active_subscriptions() {
      return /* @__PURE__ */ z.array(CustomerStateSubscription);
    },
    get granted_benefits() {
      return /* @__PURE__ */ z.array(CustomerStateBenefitGrant);
    },
    get active_meters() {
      return /* @__PURE__ */ z.array(CustomerStateMeter);
    },
  });
export const CustomerStateMeter: ObjectSchema<models.CustomerStateMeter> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    meter_id: /* @__PURE__ */ z.string(),
    consumed_units: /* @__PURE__ */ z.number(),
    credited_units: /* @__PURE__ */ z.int(),
    balance: /* @__PURE__ */ z.number(),
  });
export const CustomerStateSubscription: ObjectSchema<models.CustomerStateSubscription> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    custom_field_data: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.boolean(),
          /* @__PURE__ */ z.null(),
        ]),
      ),
    ),
    get metadata() {
      return MetadataOutputType;
    },
    status: /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.literal("active"),
      /* @__PURE__ */ z.literal("trialing"),
    ]),
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    recurring_interval: RecurringInterval,
    current_period_start: /* @__PURE__ */ z.string(),
    current_period_end: /* @__PURE__ */ z.string(),
    trial_start: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    trial_end: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    cancel_at_period_end: /* @__PURE__ */ z.boolean(),
    canceled_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    started_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ends_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    product_id: /* @__PURE__ */ z.string(),
    discount_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    seats: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    get meters() {
      return /* @__PURE__ */ z.array(CustomerStateSubscriptionMeter);
    },
  });
export const CustomerStateSubscriptionMeter: ObjectSchema<models.CustomerStateSubscriptionMeter> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    consumed_units: /* @__PURE__ */ z.number(),
    credited_units: /* @__PURE__ */ z.int(),
    amount: /* @__PURE__ */ z.int(),
    meter_id: /* @__PURE__ */ z.string(),
  });
export const CustomerStateTeam: ObjectSchema<models.CustomerStateTeam> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get metadata() {
      return MetadataOutputType;
    },
    external_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    email_verified: /* @__PURE__ */ z.boolean(),
    type: /* @__PURE__ */ z.literal("team"),
    name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    billing_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get billing_address() {
      return /* @__PURE__ */ z.nullable(Address);
    },
    tax_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.unknown())),
    locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    organization_id: /* @__PURE__ */ z.string(),
    default_payment_method_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    deleted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    first_user_event_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    avatar_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get active_subscriptions() {
      return /* @__PURE__ */ z.array(CustomerStateSubscription);
    },
    get granted_benefits() {
      return /* @__PURE__ */ z.array(CustomerStateBenefitGrant);
    },
    get active_meters() {
      return /* @__PURE__ */ z.array(CustomerStateMeter);
    },
  });
export const CustomerSubscription: ObjectSchema<models.CustomerSubscription> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    recurring_interval: RecurringInterval,
    recurring_interval_count: /* @__PURE__ */ z.int(),
    status: SubscriptionStatus,
    current_period_start: /* @__PURE__ */ z.string(),
    current_period_end: /* @__PURE__ */ z.string(),
    current_meter_period_start: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    current_meter_period_end: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    trial_start: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    trial_end: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    cancel_at_period_end: /* @__PURE__ */ z.boolean(),
    canceled_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    started_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ends_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ended_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    past_due_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    pause_at_period_end: /* @__PURE__ */ z.boolean(),
    paused_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    resumes_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.string(),
    discount_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checkout_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    customer_cancellation_reason: /* @__PURE__ */ z.nullable(CustomerCancellationReason),
    customer_cancellation_comment: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get product() {
      return CustomerSubscriptionProduct;
    },
    get prices() {
      return /* @__PURE__ */ z.array(
        /* @__PURE__ */ z.union([LegacyRecurringProductPrice, ProductPrice]),
      );
    },
    get meters() {
      return /* @__PURE__ */ z.array(CustomerSubscriptionMeter);
    },
    get pending_update() {
      return /* @__PURE__ */ z.nullable(PendingSubscriptionUpdate);
    },
  });
export const CustomerSubscriptionCancel: ObjectSchema<models.CustomerSubscriptionCancel> =
  /* @__PURE__ */ z.looseObject({
    cancel_at_period_end: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean()),
    ),
    cancellation_reason: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(CustomerCancellationReason),
    ),
    cancellation_comment: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
  });
export const CustomerSubscriptionMeter: ObjectSchema<models.CustomerSubscriptionMeter> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    consumed_units: /* @__PURE__ */ z.number(),
    credited_units: /* @__PURE__ */ z.int(),
    amount: /* @__PURE__ */ z.int(),
    meter_id: /* @__PURE__ */ z.string(),
    get meter() {
      return CustomerSubscriptionMeterMeter;
    },
  });
export const CustomerSubscriptionMeterMeter: ObjectSchema<models.CustomerSubscriptionMeterMeter> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
  });
export const CustomerSubscriptionPause: ObjectSchema<models.CustomerSubscriptionPause> =
  /* @__PURE__ */ z.looseObject({
    pause_at_period_end: /* @__PURE__ */ z.boolean(),
    resumes_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const CustomerSubscriptionProduct: ObjectSchema<models.CustomerSubscriptionProduct> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    trial_interval: /* @__PURE__ */ z.nullable(TrialInterval),
    trial_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    name: /* @__PURE__ */ z.string(),
    description: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    visibility: ProductVisibility,
    recurring_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
    recurring_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    meter_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
    meter_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    is_recurring: /* @__PURE__ */ z.boolean(),
    is_archived: /* @__PURE__ */ z.boolean(),
    organization_id: /* @__PURE__ */ z.string(),
    get prices() {
      return /* @__PURE__ */ z.array(
        /* @__PURE__ */ z.union([LegacyRecurringProductPrice, ProductPrice]),
      );
    },
    get benefits() {
      return /* @__PURE__ */ z.array(BenefitPublic);
    },
    get medias() {
      return /* @__PURE__ */ z.array(ProductMediaFileRead);
    },
    get organization() {
      return CustomerOrganization;
    },
  });
export const CustomerSubscriptionResume: ObjectSchema<models.CustomerSubscriptionResume> =
  /* @__PURE__ */ z.looseObject({ resume: /* @__PURE__ */ z.literal(true) });
export const CustomerSubscriptionUpdateClear: ObjectSchema<models.CustomerSubscriptionUpdateClear> =
  /* @__PURE__ */ z.looseObject({ pending_update: /* @__PURE__ */ z.null() });
export const CustomerSubscriptionUpdateProduct: ObjectSchema<models.CustomerSubscriptionUpdateProduct> =
  /* @__PURE__ */ z.looseObject({ product_id: /* @__PURE__ */ z.string() });
export const CustomerSubscriptionUpdateSeats: ObjectSchema<models.CustomerSubscriptionUpdateSeats> =
  /* @__PURE__ */ z.looseObject({ seats: /* @__PURE__ */ z.int() });
export const CustomerSubscriptionUpdateUnits: ObjectSchema<models.CustomerSubscriptionUpdateUnits> =
  /* @__PURE__ */ z.looseObject({ units: /* @__PURE__ */ z.int() });
export const CustomerTeam: ObjectSchema<models.CustomerTeam> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get metadata() {
    return MetadataOutputType;
  },
  external_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  email_verified: /* @__PURE__ */ z.boolean(),
  type: /* @__PURE__ */ z.literal("team"),
  name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  billing_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get billing_address() {
    return /* @__PURE__ */ z.nullable(Address);
  },
  tax_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.unknown())),
  locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  organization_id: /* @__PURE__ */ z.string(),
  default_payment_method_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  deleted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  first_user_event_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  avatar_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
});
export const CustomerTeamCreate: ObjectSchema<models.CustomerTeamCreate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    external_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    get billing_address() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(AddressInput));
    },
    tax_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    get owner() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(MemberOwnerCreate));
    },
    type: /* @__PURE__ */ z.literal("team"),
    email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const CustomerUpdate: ObjectSchema<models.CustomerUpdate> = /* @__PURE__ */ z.looseObject({
  metadata: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.number(),
        /* @__PURE__ */ z.boolean(),
      ]),
    ),
  ),
  email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  get billing_address() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(AddressInput));
  },
  tax_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  external_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  type: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(CustomerType)),
});
export const CustomerUpdateExternalID: ObjectSchema<models.CustomerUpdateExternalID> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    get billing_address() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(AddressInput));
    },
    tax_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const CustomerUpdatedEvent: ObjectSchema<models.CustomerUpdatedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("customer.updated"),
    get metadata() {
      return CustomerUpdatedMetadata;
    },
  });
export const CustomerUpdatedFields: ObjectSchema<models.CustomerUpdatedFields> =
  /* @__PURE__ */ z.looseObject({
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    billing_name: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    get billing_address() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(AddressDict));
    },
    tax_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(
        /* @__PURE__ */ z.record(
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.union([
            /* @__PURE__ */ z.string(),
            /* @__PURE__ */ z.int(),
            /* @__PURE__ */ z.boolean(),
          ]),
        ),
      ),
    ),
  });
export const CustomerUpdatedMetadata: ObjectSchema<models.CustomerUpdatedMetadata> =
  /* @__PURE__ */ z.looseObject({
    customer_id: /* @__PURE__ */ z.string(),
    customer_email: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_external_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get updated_fields() {
      return CustomerUpdatedFields;
    },
  });
export const CustomerWallet: ObjectSchema<models.CustomerWallet> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  customer_id: /* @__PURE__ */ z.string(),
  balance: /* @__PURE__ */ z.int(),
  currency: /* @__PURE__ */ z.string(),
});
export const DiscountFixedCreate: ObjectSchema<models.DiscountFixedCreate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    name: /* @__PURE__ */ z.string(),
    code: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    starts_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    ends_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    max_redemptions: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
    max_redemptions_per_customer: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
    products: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
    ),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    type: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.literal("fixed")),
    duration: DiscountDuration,
    duration_in_months: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
    amounts: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(
        /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.int()),
      ),
    ),
    amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    currency: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(PresentmentCurrency)),
  });
export const DiscountFixedOnceForeverDuration: ObjectSchema<models.DiscountFixedOnceForeverDuration> =
  /* @__PURE__ */ z.looseObject({
    duration: DiscountDuration,
    type: DiscountType,
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    amounts: /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.int()),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    name: /* @__PURE__ */ z.string(),
    code: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    starts_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ends_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    max_redemptions: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    max_redemptions_per_customer: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    redemptions_count: /* @__PURE__ */ z.int(),
    organization_id: /* @__PURE__ */ z.string(),
    get products() {
      return /* @__PURE__ */ z.array(DiscountProduct);
    },
  });
export const DiscountFixedOnceForeverDurationBase: ObjectSchema<models.DiscountFixedOnceForeverDurationBase> =
  /* @__PURE__ */ z.looseObject({
    duration: DiscountDuration,
    type: DiscountType,
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    amounts: /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.int()),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    name: /* @__PURE__ */ z.string(),
    code: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    starts_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ends_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    max_redemptions: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    max_redemptions_per_customer: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    redemptions_count: /* @__PURE__ */ z.int(),
    organization_id: /* @__PURE__ */ z.string(),
  });
export const DiscountFixedRepeatDuration: ObjectSchema<models.DiscountFixedRepeatDuration> =
  /* @__PURE__ */ z.looseObject({
    duration: DiscountDuration,
    duration_in_months: /* @__PURE__ */ z.int(),
    type: DiscountType,
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    amounts: /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.int()),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    name: /* @__PURE__ */ z.string(),
    code: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    starts_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ends_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    max_redemptions: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    max_redemptions_per_customer: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    redemptions_count: /* @__PURE__ */ z.int(),
    organization_id: /* @__PURE__ */ z.string(),
    get products() {
      return /* @__PURE__ */ z.array(DiscountProduct);
    },
  });
export const DiscountFixedRepeatDurationBase: ObjectSchema<models.DiscountFixedRepeatDurationBase> =
  /* @__PURE__ */ z.looseObject({
    duration: DiscountDuration,
    duration_in_months: /* @__PURE__ */ z.int(),
    type: DiscountType,
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    amounts: /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.int()),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    name: /* @__PURE__ */ z.string(),
    code: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    starts_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ends_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    max_redemptions: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    max_redemptions_per_customer: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    redemptions_count: /* @__PURE__ */ z.int(),
    organization_id: /* @__PURE__ */ z.string(),
  });
export const DiscountPercentageCreate: ObjectSchema<models.DiscountPercentageCreate> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    name: /* @__PURE__ */ z.string(),
    code: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    starts_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    ends_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    max_redemptions: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
    max_redemptions_per_customer: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
    products: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
    ),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    type: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.literal("percentage")),
    duration: DiscountDuration,
    duration_in_months: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
    basis_points: /* @__PURE__ */ z.int(),
  });
export const DiscountPercentageOnceForeverDuration: ObjectSchema<models.DiscountPercentageOnceForeverDuration> =
  /* @__PURE__ */ z.looseObject({
    duration: DiscountDuration,
    type: DiscountType,
    basis_points: /* @__PURE__ */ z.int(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    name: /* @__PURE__ */ z.string(),
    code: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    starts_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ends_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    max_redemptions: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    max_redemptions_per_customer: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    redemptions_count: /* @__PURE__ */ z.int(),
    organization_id: /* @__PURE__ */ z.string(),
    get products() {
      return /* @__PURE__ */ z.array(DiscountProduct);
    },
  });
export const DiscountPercentageOnceForeverDurationBase: ObjectSchema<models.DiscountPercentageOnceForeverDurationBase> =
  /* @__PURE__ */ z.looseObject({
    duration: DiscountDuration,
    type: DiscountType,
    basis_points: /* @__PURE__ */ z.int(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    name: /* @__PURE__ */ z.string(),
    code: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    starts_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ends_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    max_redemptions: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    max_redemptions_per_customer: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    redemptions_count: /* @__PURE__ */ z.int(),
    organization_id: /* @__PURE__ */ z.string(),
  });
export const DiscountPercentageRepeatDuration: ObjectSchema<models.DiscountPercentageRepeatDuration> =
  /* @__PURE__ */ z.looseObject({
    duration: DiscountDuration,
    duration_in_months: /* @__PURE__ */ z.int(),
    type: DiscountType,
    basis_points: /* @__PURE__ */ z.int(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    name: /* @__PURE__ */ z.string(),
    code: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    starts_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ends_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    max_redemptions: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    max_redemptions_per_customer: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    redemptions_count: /* @__PURE__ */ z.int(),
    organization_id: /* @__PURE__ */ z.string(),
    get products() {
      return /* @__PURE__ */ z.array(DiscountProduct);
    },
  });
export const DiscountPercentageRepeatDurationBase: ObjectSchema<models.DiscountPercentageRepeatDurationBase> =
  /* @__PURE__ */ z.looseObject({
    duration: DiscountDuration,
    duration_in_months: /* @__PURE__ */ z.int(),
    type: DiscountType,
    basis_points: /* @__PURE__ */ z.int(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    get metadata() {
      return MetadataOutputType;
    },
    name: /* @__PURE__ */ z.string(),
    code: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    starts_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ends_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    max_redemptions: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    max_redemptions_per_customer: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    redemptions_count: /* @__PURE__ */ z.int(),
    organization_id: /* @__PURE__ */ z.string(),
  });
export const DiscountProduct: ObjectSchema<models.DiscountProduct> = /* @__PURE__ */ z.looseObject({
  get metadata() {
    return MetadataOutputType;
  },
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  trial_interval: /* @__PURE__ */ z.nullable(TrialInterval),
  trial_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  name: /* @__PURE__ */ z.string(),
  description: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  visibility: ProductVisibility,
  recurring_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
  recurring_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  meter_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
  meter_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  is_recurring: /* @__PURE__ */ z.boolean(),
  is_archived: /* @__PURE__ */ z.boolean(),
  organization_id: /* @__PURE__ */ z.string(),
});
export const DiscountRedemptionLimitReached: ObjectSchema<models.DiscountRedemptionLimitReached> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("DiscountRedemptionLimitReached"),
    detail: /* @__PURE__ */ z.string(),
  });
export const DiscountUpdate: ObjectSchema<models.DiscountUpdate> = /* @__PURE__ */ z.looseObject({
  metadata: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.number(),
        /* @__PURE__ */ z.boolean(),
      ]),
    ),
  ),
  name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  code: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  starts_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  ends_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  max_redemptions: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  max_redemptions_per_customer: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  ),
  duration: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(DiscountDuration)),
  duration_in_months: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  ),
  type: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(DiscountType)),
  amounts: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(
      /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.int()),
    ),
  ),
  basis_points: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  products: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
  ),
  amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  currency: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(PresentmentCurrency)),
});
export const Dispute: ObjectSchema<models.Dispute> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  status: DisputeStatus,
  resolved: /* @__PURE__ */ z.boolean(),
  closed: /* @__PURE__ */ z.boolean(),
  amount: /* @__PURE__ */ z.int(),
  tax_amount: /* @__PURE__ */ z.int(),
  currency: /* @__PURE__ */ z.string(),
  reason: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  evidence_due_by: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  past_due: /* @__PURE__ */ z.boolean(),
  order_id: /* @__PURE__ */ z.string(),
  payment_id: /* @__PURE__ */ z.string(),
  get customer() {
    return DisputeCustomer;
  },
  case_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
});
export const DisputeAutoAcceptNotEnabled: ObjectSchema<models.DisputeAutoAcceptNotEnabled> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("DisputeAutoAcceptNotEnabled"),
    detail: /* @__PURE__ */ z.string(),
  });
export const DisputeCustomer: ObjectSchema<models.DisputeCustomer> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get metadata() {
    return MetadataOutputType;
  },
  external_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  email_verified: /* @__PURE__ */ z.boolean(),
  type: CustomerType,
  name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  billing_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get billing_address() {
    return /* @__PURE__ */ z.nullable(Address);
  },
  tax_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.unknown())),
  locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  organization_id: /* @__PURE__ */ z.string(),
  default_payment_method_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  deleted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  first_user_event_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  avatar_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
});
export const DisputeNotOpenError: ObjectSchema<models.DisputeNotOpenError> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("DisputeNotOpenError"),
    detail: /* @__PURE__ */ z.string(),
  });
export const DownloadableFileCreate: ObjectSchema<models.DownloadableFileCreate> =
  /* @__PURE__ */ z.looseObject({
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    name: /* @__PURE__ */ z.string(),
    mime_type: /* @__PURE__ */ z.string(),
    size: /* @__PURE__ */ z.int(),
    checksum_sha256_base64: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    get upload() {
      return S3FileCreateMultipart;
    },
    service: /* @__PURE__ */ z.literal("downloadable"),
    version: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const DownloadableFileRead: ObjectSchema<models.DownloadableFileRead> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    path: /* @__PURE__ */ z.string(),
    mime_type: /* @__PURE__ */ z.string(),
    size: /* @__PURE__ */ z.int(),
    storage_version: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checksum_etag: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checksum_sha256_base64: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checksum_sha256_hex: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    last_modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    version: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    service: /* @__PURE__ */ z.literal("downloadable"),
    is_uploaded: /* @__PURE__ */ z.boolean(),
    created_at: /* @__PURE__ */ z.string(),
    flagged_malicious_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    size_readable: /* @__PURE__ */ z.string(),
  });
export const DownloadableRead: ObjectSchema<models.DownloadableRead> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    benefit_id: /* @__PURE__ */ z.string(),
    get file() {
      return FileDownload;
    },
  });
export const EventCreateCustomer: ObjectSchema<models.EventCreateCustomer> =
  /* @__PURE__ */ z.looseObject({
    timestamp: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    name: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    external_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    get metadata() {
      return /* @__PURE__ */ z.optional(EventMetadataInput);
    },
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const EventCreateExternalCustomer: ObjectSchema<models.EventCreateExternalCustomer> =
  /* @__PURE__ */ z.looseObject({
    timestamp: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    name: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    external_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    get metadata() {
      return /* @__PURE__ */ z.optional(EventMetadataInput);
    },
    external_customer_id: /* @__PURE__ */ z.string(),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
  });
export const EventMetadataInput: ObjectSchema<models.EventMetadataInput> =
  /* @__PURE__ */ z.catchall(
    /* @__PURE__ */ z.object({
      _cost: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.lazy(() => CostMetadataInput)),
      _llm: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.lazy(() => LLMMetadata)),
    }),
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.boolean(),
    ]),
  );
export const EventMetadataOutput: ObjectSchema<models.EventMetadataOutput> =
  /* @__PURE__ */ z.catchall(
    /* @__PURE__ */ z.object({
      _cost: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.lazy(() => CostMetadataOutput)),
      _llm: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.lazy(() => LLMMetadata)),
    }),
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.boolean(),
    ]),
  );
export const EventName: ObjectSchema<models.EventName> = /* @__PURE__ */ z.looseObject({
  name: /* @__PURE__ */ z.string(),
  label: /* @__PURE__ */ z.string(),
  source: EventSource,
  occurrences: /* @__PURE__ */ z.int(),
  first_seen: /* @__PURE__ */ z.string(),
  last_seen: /* @__PURE__ */ z.string(),
});
export const EventType: ObjectSchema<models.EventType> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  name: /* @__PURE__ */ z.string(),
  label: /* @__PURE__ */ z.string(),
  label_property_selector: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  organization_id: /* @__PURE__ */ z.string(),
});
export const EventTypeUpdate: ObjectSchema<models.EventTypeUpdate> = /* @__PURE__ */ z.looseObject({
  label: /* @__PURE__ */ z.string(),
  label_property_selector: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
});
export const EventTypeWithStats: ObjectSchema<models.EventTypeWithStats> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    created_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    modified_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    name: /* @__PURE__ */ z.string(),
    label: /* @__PURE__ */ z.string(),
    label_property_selector: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    organization_id: /* @__PURE__ */ z.string(),
    source: EventSource,
    occurrences: /* @__PURE__ */ z.int(),
    first_seen: /* @__PURE__ */ z.string(),
    last_seen: /* @__PURE__ */ z.string(),
  });
export const EventsIngest: ObjectSchema<models.EventsIngest> = /* @__PURE__ */ z.looseObject({
  get events() {
    return /* @__PURE__ */ z.array(
      /* @__PURE__ */ z.union([EventCreateCustomer, EventCreateExternalCustomer]),
    );
  },
});
export const EventsIngestResponse: ObjectSchema<models.EventsIngestResponse> =
  /* @__PURE__ */ z.looseObject({
    inserted: /* @__PURE__ */ z.int(),
    duplicates: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
  });
export const ExistingProductPrice: ObjectSchema<models.ExistingProductPrice> =
  /* @__PURE__ */ z.looseObject({ id: /* @__PURE__ */ z.string() });
export const ExpiredCheckoutError: ObjectSchema<models.ExpiredCheckoutError> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("ExpiredCheckoutError"),
    detail: /* @__PURE__ */ z.string(),
  });
export const FileDownload: ObjectSchema<models.FileDownload> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  organization_id: /* @__PURE__ */ z.string(),
  name: /* @__PURE__ */ z.string(),
  path: /* @__PURE__ */ z.string(),
  mime_type: /* @__PURE__ */ z.string(),
  size: /* @__PURE__ */ z.int(),
  storage_version: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  checksum_etag: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  checksum_sha256_base64: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  checksum_sha256_hex: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  last_modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get download() {
    return S3DownloadURL;
  },
  version: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  is_uploaded: /* @__PURE__ */ z.boolean(),
  service: FileServiceTypes,
  size_readable: /* @__PURE__ */ z.string(),
});
export const FilePatch: ObjectSchema<models.FilePatch> = /* @__PURE__ */ z.looseObject({
  name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  version: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
});
export const FileUpload: ObjectSchema<models.FileUpload> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  organization_id: /* @__PURE__ */ z.string(),
  name: /* @__PURE__ */ z.string(),
  path: /* @__PURE__ */ z.string(),
  mime_type: /* @__PURE__ */ z.string(),
  size: /* @__PURE__ */ z.int(),
  storage_version: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  checksum_etag: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  checksum_sha256_base64: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  checksum_sha256_hex: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  last_modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get upload() {
    return S3FileUploadMultipart;
  },
  version: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  is_uploaded: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
  service: FileServiceTypes,
  size_readable: /* @__PURE__ */ z.string(),
});
export const FileUploadCompleted: ObjectSchema<models.FileUploadCompleted> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    path: /* @__PURE__ */ z.string(),
    get parts() {
      return /* @__PURE__ */ z.array(S3FileUploadCompletedPart);
    },
  });
export const Filter: ObjectSchema<models.Filter> = /* @__PURE__ */ z.looseObject({
  conjunction: FilterConjunction,
  get clauses() {
    return /* @__PURE__ */ z.array(/* @__PURE__ */ z.union([FilterClause, Filter]));
  },
});
export const FilterClause: ObjectSchema<models.FilterClause> = /* @__PURE__ */ z.looseObject({
  property: /* @__PURE__ */ z.string(),
  operator: FilterOperator,
  value: /* @__PURE__ */ z.union([
    /* @__PURE__ */ z.string(),
    /* @__PURE__ */ z.int(),
    /* @__PURE__ */ z.boolean(),
  ]),
});
export const GenericPayment: ObjectSchema<models.GenericPayment> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  processor: PaymentProcessor,
  status: PaymentStatus,
  amount: /* @__PURE__ */ z.int(),
  currency: /* @__PURE__ */ z.string(),
  method: /* @__PURE__ */ z.string(),
  trigger: /* @__PURE__ */ z.nullable(PaymentTrigger),
  decline_reason: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  decline_message: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  organization_id: /* @__PURE__ */ z.string(),
  checkout_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  processor_metadata: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.unknown()),
  ),
});
export const GrantedLicenseKey: ObjectSchema<models.GrantedLicenseKey> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.string(),
    get customer() {
      return LicenseKeyCustomer;
    },
    member_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get member() {
      return /* @__PURE__ */ z.nullable(LicenseKeyMember);
    },
    benefit_id: /* @__PURE__ */ z.string(),
    key: /* @__PURE__ */ z.string(),
    display_key: /* @__PURE__ */ z.string(),
    status: /* @__PURE__ */ z.literal("granted"),
    limit_activations: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    usage: /* @__PURE__ */ z.int(),
    limit_usage: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    validations: /* @__PURE__ */ z.int(),
    last_validated_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    expires_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const HTTPValidationError: ObjectSchema<models.HTTPValidationError> =
  /* @__PURE__ */ z.looseObject({
    get detail() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.array(ValidationError));
    },
  });
export const InactiveSubscription: ObjectSchema<models.InactiveSubscription> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("InactiveSubscription"),
    detail: /* @__PURE__ */ z.string(),
  });
export const IntrospectTokenResponse: ObjectSchema<models.IntrospectTokenResponse> =
  /* @__PURE__ */ z.looseObject({
    active: /* @__PURE__ */ z.boolean(),
    client_id: /* @__PURE__ */ z.string(),
    token_type: TokenType,
    scope: /* @__PURE__ */ z.string(),
    sub_type: SubType,
    sub: /* @__PURE__ */ z.string(),
    organizations: /* @__PURE__ */ z.array(/* @__PURE__ */ z.string()),
    aud: /* @__PURE__ */ z.string(),
    iss: /* @__PURE__ */ z.string(),
    exp: /* @__PURE__ */ z.int(),
    iat: /* @__PURE__ */ z.int(),
  });
export const KrCardPayment: ObjectSchema<models.KrCardPayment> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  processor: PaymentProcessor,
  status: PaymentStatus,
  amount: /* @__PURE__ */ z.int(),
  currency: /* @__PURE__ */ z.string(),
  method: /* @__PURE__ */ z.literal("kr_card"),
  trigger: /* @__PURE__ */ z.nullable(PaymentTrigger),
  decline_reason: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  decline_message: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  organization_id: /* @__PURE__ */ z.string(),
  checkout_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  order_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  processor_metadata: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.unknown()),
  ),
  get method_metadata() {
    return KrCardPaymentMetadata;
  },
});
export const KrCardPaymentMetadata: ObjectSchema<models.KrCardPaymentMetadata> =
  /* @__PURE__ */ z.looseObject({
    brand: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    last4: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const LLMMetadata: ObjectSchema<models.LLMMetadata> = /* @__PURE__ */ z.looseObject({
  vendor: /* @__PURE__ */ z.string(),
  model: /* @__PURE__ */ z.string(),
  prompt: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  response: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  input_tokens: /* @__PURE__ */ z.int(),
  cached_input_tokens: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
  output_tokens: /* @__PURE__ */ z.int(),
  total_tokens: /* @__PURE__ */ z.int(),
});
export const LegacyRecurringProductPriceCustom: ObjectSchema<models.LegacyRecurringProductPriceCustom> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    source: ProductPriceSource,
    amount_type: /* @__PURE__ */ z.literal("custom"),
    price_currency: /* @__PURE__ */ z.string(),
    tax_behavior: /* @__PURE__ */ z.nullable(TaxBehaviorOption),
    is_archived: /* @__PURE__ */ z.boolean(),
    product_id: /* @__PURE__ */ z.string(),
    type: /* @__PURE__ */ z.literal("recurring"),
    recurring_interval: RecurringInterval,
    minimum_amount: /* @__PURE__ */ z.int(),
    maximum_amount: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    preset_amount: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    legacy: /* @__PURE__ */ z.literal(true),
  });
export const LegacyRecurringProductPriceFixed: ObjectSchema<models.LegacyRecurringProductPriceFixed> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    source: ProductPriceSource,
    amount_type: /* @__PURE__ */ z.literal("fixed"),
    price_currency: /* @__PURE__ */ z.string(),
    tax_behavior: /* @__PURE__ */ z.nullable(TaxBehaviorOption),
    is_archived: /* @__PURE__ */ z.boolean(),
    product_id: /* @__PURE__ */ z.string(),
    type: /* @__PURE__ */ z.literal("recurring"),
    recurring_interval: RecurringInterval,
    price_amount: /* @__PURE__ */ z.int(),
    legacy: /* @__PURE__ */ z.literal(true),
  });
export const LicenseKeyActivate: ObjectSchema<models.LicenseKeyActivate> =
  /* @__PURE__ */ z.looseObject({
    key: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    label: /* @__PURE__ */ z.string(),
    conditions: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    meta: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
  });
export const LicenseKeyActivationBase: ObjectSchema<models.LicenseKeyActivationBase> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    license_key_id: /* @__PURE__ */ z.string(),
    label: /* @__PURE__ */ z.string(),
    meta: /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.number(),
        /* @__PURE__ */ z.boolean(),
      ]),
    ),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const LicenseKeyActivationCreated: ObjectSchema<models.LicenseKeyActivationCreated> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    license_key_id: /* @__PURE__ */ z.string(),
    label: /* @__PURE__ */ z.string(),
    meta: /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.number(),
        /* @__PURE__ */ z.boolean(),
      ]),
    ),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get license_key() {
      return GrantedLicenseKey;
    },
  });
export const LicenseKeyActivationRead: ObjectSchema<models.LicenseKeyActivationRead> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    license_key_id: /* @__PURE__ */ z.string(),
    label: /* @__PURE__ */ z.string(),
    meta: /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.number(),
        /* @__PURE__ */ z.boolean(),
      ]),
    ),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get license_key() {
      return LicenseKeyRead;
    },
  });
export const LicenseKeyCustomer: ObjectSchema<models.LicenseKeyCustomer> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get metadata() {
      return MetadataOutputType;
    },
    external_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    email_verified: /* @__PURE__ */ z.boolean(),
    type: CustomerType,
    name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    billing_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get billing_address() {
      return /* @__PURE__ */ z.nullable(Address);
    },
    tax_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.unknown())),
    locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    organization_id: /* @__PURE__ */ z.string(),
    default_payment_method_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    deleted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    first_user_event_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    avatar_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const LicenseKeyDeactivate: ObjectSchema<models.LicenseKeyDeactivate> =
  /* @__PURE__ */ z.looseObject({
    key: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    activation_id: /* @__PURE__ */ z.string(),
  });
export const LicenseKeyMember: ObjectSchema<models.LicenseKeyMember> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    email: /* @__PURE__ */ z.string(),
    external_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const LicenseKeyRead: ObjectSchema<models.LicenseKeyRead> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  organization_id: /* @__PURE__ */ z.string(),
  customer_id: /* @__PURE__ */ z.string(),
  get customer() {
    return LicenseKeyCustomer;
  },
  member_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get member() {
    return /* @__PURE__ */ z.nullable(LicenseKeyMember);
  },
  benefit_id: /* @__PURE__ */ z.string(),
  key: /* @__PURE__ */ z.string(),
  display_key: /* @__PURE__ */ z.string(),
  status: LicenseKeyStatus,
  limit_activations: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  usage: /* @__PURE__ */ z.int(),
  limit_usage: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  validations: /* @__PURE__ */ z.int(),
  last_validated_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  expires_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
});
export const LicenseKeyUpdate: ObjectSchema<models.LicenseKeyUpdate> =
  /* @__PURE__ */ z.looseObject({
    status: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(LicenseKeyStatus)),
    usage: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    limit_activations: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
    limit_usage: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    expires_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const LicenseKeyValidate: ObjectSchema<models.LicenseKeyValidate> =
  /* @__PURE__ */ z.looseObject({
    key: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    activation_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    benefit_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    customer_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    increment_usage: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
    conditions: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
  });
export const LicenseKeyWithActivations: ObjectSchema<models.LicenseKeyWithActivations> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.string(),
    get customer() {
      return LicenseKeyCustomer;
    },
    member_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get member() {
      return /* @__PURE__ */ z.nullable(LicenseKeyMember);
    },
    benefit_id: /* @__PURE__ */ z.string(),
    key: /* @__PURE__ */ z.string(),
    display_key: /* @__PURE__ */ z.string(),
    status: LicenseKeyStatus,
    limit_activations: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    usage: /* @__PURE__ */ z.int(),
    limit_usage: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    validations: /* @__PURE__ */ z.int(),
    last_validated_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    expires_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get activations() {
      return /* @__PURE__ */ z.array(LicenseKeyActivationBase);
    },
  });
export const ListResourceBenefit: ObjectSchema<models.ListResourceBenefit> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(Benefit);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceBenefitDownloadableFile: ObjectSchema<models.ListResourceBenefitDownloadableFile> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(BenefitDownloadableFile);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceBenefitGrant: ObjectSchema<models.ListResourceBenefitGrant> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(BenefitGrant);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceCheckout: ObjectSchema<models.ListResourceCheckout> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(Checkout);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceCheckoutLink: ObjectSchema<models.ListResourceCheckoutLink> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(CheckoutLink);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceCustomField: ObjectSchema<models.ListResourceCustomField> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(CustomField);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceCustomer: ObjectSchema<models.ListResourceCustomer> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(Customer);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceCustomerBenefitGrant: ObjectSchema<models.ListResourceCustomerBenefitGrant> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(CustomerBenefitGrant);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceCustomerCustomerMeter: ObjectSchema<models.ListResourceCustomerCustomerMeter> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(CustomerCustomerMeter);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceCustomerMeter: ObjectSchema<models.ListResourceCustomerMeter> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(CustomerMeter);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceCustomerOrder: ObjectSchema<models.ListResourceCustomerOrder> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(CustomerOrder);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceCustomerPaymentMethod: ObjectSchema<models.ListResourceCustomerPaymentMethod> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(CustomerPaymentMethod);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceCustomerPortalMember: ObjectSchema<models.ListResourceCustomerPortalMember> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(CustomerPortalMember);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceCustomerSubscription: ObjectSchema<models.ListResourceCustomerSubscription> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(CustomerSubscription);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceCustomerWallet: ObjectSchema<models.ListResourceCustomerWallet> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(CustomerWallet);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceDiscount: ObjectSchema<models.ListResourceDiscount> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(Discount);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceDispute: ObjectSchema<models.ListResourceDispute> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(Dispute);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceDownloadableRead: ObjectSchema<models.ListResourceDownloadableRead> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(DownloadableRead);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceEvent: ObjectSchema<models.ListResourceEvent> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(Event);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceEventName: ObjectSchema<models.ListResourceEventName> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(EventName);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceEventTypeWithStats: ObjectSchema<models.ListResourceEventTypeWithStats> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(EventTypeWithStats);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceFileRead: ObjectSchema<models.ListResourceFileRead> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(FileRead);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceLicenseKeyRead: ObjectSchema<models.ListResourceLicenseKeyRead> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(LicenseKeyRead);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceMember: ObjectSchema<models.ListResourceMember> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(Member);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceMeter: ObjectSchema<models.ListResourceMeter> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(Meter);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceOrder: ObjectSchema<models.ListResourceOrder> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(Order);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceOrganization: ObjectSchema<models.ListResourceOrganization> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(Organization);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourcePayment: ObjectSchema<models.ListResourcePayment> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(Payment);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourcePaymentMethod: ObjectSchema<models.ListResourcePaymentMethod> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(PaymentMethod);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceProduct: ObjectSchema<models.ListResourceProduct> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(Product);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceRefund: ObjectSchema<models.ListResourceRefund> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(Refund);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceSubscription: ObjectSchema<models.ListResourceSubscription> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(Subscription);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceWebhookDelivery: ObjectSchema<models.ListResourceWebhookDelivery> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(WebhookDelivery);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceWebhookEndpoint: ObjectSchema<models.ListResourceWebhookEndpoint> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(WebhookEndpoint);
    },
    get pagination() {
      return Pagination;
    },
  });
export const ListResourceWithCursorPaginationEvent: ObjectSchema<models.ListResourceWithCursorPaginationEvent> =
  /* @__PURE__ */ z.looseObject({
    get items() {
      return /* @__PURE__ */ z.array(Event);
    },
    get pagination() {
      return CursorPagination;
    },
  });
export const ManualRetryLimitExceeded: ObjectSchema<models.ManualRetryLimitExceeded> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("ManualRetryLimitExceeded"),
    detail: /* @__PURE__ */ z.string(),
  });
export const Member: ObjectSchema<models.Member> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  customer_id: /* @__PURE__ */ z.string(),
  email: /* @__PURE__ */ z.string(),
  name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  external_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  role: MemberRole,
});
export const MemberCreateFromCustomer: ObjectSchema<models.MemberCreateFromCustomer> =
  /* @__PURE__ */ z.looseObject({
    email: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    role: /* @__PURE__ */ z.optional(Role),
  });
export const MemberOwnerCreate: ObjectSchema<models.MemberOwnerCreate> =
  /* @__PURE__ */ z.looseObject({
    email: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const MemberUpdate: ObjectSchema<models.MemberUpdate> = /* @__PURE__ */ z.looseObject({
  name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  role: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(MemberRole)),
});
export const MetadataOutputType: Schema<models.MetadataOutputType> = /* @__PURE__ */ z.record(
  /* @__PURE__ */ z.string(),
  /* @__PURE__ */ z.union([
    /* @__PURE__ */ z.string(),
    /* @__PURE__ */ z.int(),
    /* @__PURE__ */ z.number(),
    /* @__PURE__ */ z.boolean(),
  ]),
);
export const Meter: ObjectSchema<models.Meter> = /* @__PURE__ */ z.looseObject({
  get metadata() {
    return MetadataOutputType;
  },
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  name: /* @__PURE__ */ z.string(),
  unit: MeterUnit,
  custom_label: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  custom_multiplier: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  ),
  get filter() {
    return Filter;
  },
  get aggregation() {
    return /* @__PURE__ */ z.union([CountAggregation, PropertyAggregation, UniqueAggregation]);
  },
  organization_id: /* @__PURE__ */ z.string(),
  archived_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
});
export const MeterCreate: ObjectSchema<models.MeterCreate> = /* @__PURE__ */ z.looseObject({
  metadata: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.number(),
        /* @__PURE__ */ z.boolean(),
      ]),
    ),
  ),
  name: /* @__PURE__ */ z.string(),
  unit: /* @__PURE__ */ z.optional(MeterUnit),
  custom_label: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  custom_multiplier: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  ),
  get filter() {
    return Filter;
  },
  get aggregation() {
    return /* @__PURE__ */ z.union([CountAggregation, PropertyAggregation, UniqueAggregation]);
  },
  organization_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
});
export const MeterCreditEvent: ObjectSchema<models.MeterCreditEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("meter.credited"),
    get metadata() {
      return MeterCreditedMetadata;
    },
  });
export const MeterCreditedMetadata: ObjectSchema<models.MeterCreditedMetadata> =
  /* @__PURE__ */ z.looseObject({
    meter_id: /* @__PURE__ */ z.string(),
    units: /* @__PURE__ */ z.int(),
    rollover: /* @__PURE__ */ z.boolean(),
  });
export const MeterQuantities: ObjectSchema<models.MeterQuantities> = /* @__PURE__ */ z.looseObject({
  get quantities() {
    return /* @__PURE__ */ z.array(MeterQuantity);
  },
  total: /* @__PURE__ */ z.number(),
});
export const MeterQuantity: ObjectSchema<models.MeterQuantity> = /* @__PURE__ */ z.looseObject({
  timestamp: /* @__PURE__ */ z.string(),
  quantity: /* @__PURE__ */ z.number(),
});
export const MeterResetEvent: ObjectSchema<models.MeterResetEvent> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  timestamp: /* @__PURE__ */ z.string(),
  organization_id: /* @__PURE__ */ z.string(),
  customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get customer() {
    return /* @__PURE__ */ z.nullable(Customer);
  },
  external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  external_member_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
  parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  label: /* @__PURE__ */ z.string(),
  source: /* @__PURE__ */ z.literal("system"),
  name: /* @__PURE__ */ z.literal("meter.reset"),
  get metadata() {
    return MeterResetMetadata;
  },
});
export const MeterResetMetadata: ObjectSchema<models.MeterResetMetadata> =
  /* @__PURE__ */ z.looseObject({ meter_id: /* @__PURE__ */ z.string() });
export const MeterUpdate: ObjectSchema<models.MeterUpdate> = /* @__PURE__ */ z.looseObject({
  metadata: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.number(),
        /* @__PURE__ */ z.boolean(),
      ]),
    ),
  ),
  name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  unit: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(MeterUnit)),
  custom_label: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  custom_multiplier: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  ),
  get filter() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Filter));
  },
  get aggregation() {
    return /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(
        /* @__PURE__ */ z.union([CountAggregation, PropertyAggregation, UniqueAggregation]),
      ),
    );
  },
  is_archived: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean())),
});
export const Metric: ObjectSchema<models.Metric> = /* @__PURE__ */ z.looseObject({
  slug: /* @__PURE__ */ z.string(),
  display_name: /* @__PURE__ */ z.string(),
  type: MetricType,
});
export const MetricDashboardCreate: ObjectSchema<models.MetricDashboardCreate> =
  /* @__PURE__ */ z.looseObject({
    name: /* @__PURE__ */ z.string(),
    metrics: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
  });
export const MetricDashboardSchema: ObjectSchema<models.MetricDashboardSchema> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    metrics: /* @__PURE__ */ z.array(/* @__PURE__ */ z.string()),
    organization_id: /* @__PURE__ */ z.string(),
  });
export const MetricDashboardUpdate: ObjectSchema<models.MetricDashboardUpdate> =
  /* @__PURE__ */ z.looseObject({
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    metrics: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
    ),
  });
export const MetricPeriod: ObjectSchema<models.MetricPeriod> = /* @__PURE__ */ z.looseObject({
  timestamp: /* @__PURE__ */ z.string(),
  active_subscriptions: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  committed_subscriptions: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  monthly_recurring_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  trial_monthly_recurring_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  committed_monthly_recurring_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  trial_committed_monthly_recurring_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  average_revenue_per_user: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  checkouts: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  succeeded_checkouts: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  churned_subscriptions: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  churn_rate: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  seats_total: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  seats_claimed: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  seats_pending: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  seat_customers: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  new_seat_customers: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  churned_seat_customers: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  orders: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  net_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  cumulative_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  net_cumulative_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  costs: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  cumulative_costs: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  average_order_value: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  net_average_order_value: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  cost_per_user: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  active_user_by_event: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  one_time_products: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  one_time_products_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  one_time_products_net_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  new_subscriptions: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  new_subscriptions_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  new_subscriptions_net_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  renewed_subscriptions: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  renewed_subscriptions_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  renewed_subscriptions_net_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_customer_service: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_low_quality: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_missing_features: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_switched_service: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_too_complex: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_too_expensive: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_unused: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_other: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  annual_recurring_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  committed_annual_recurring_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  checkouts_conversion: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  ltv: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  gross_margin: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  gross_margin_percentage: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  cashflow: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  average_seats_per_customer: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  seat_utilization_rate: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
});
export const Metrics: ObjectSchema<models.Metrics> = /* @__PURE__ */ z.looseObject({
  get active_subscriptions() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get committed_subscriptions() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get monthly_recurring_revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get trial_monthly_recurring_revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get committed_monthly_recurring_revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get trial_committed_monthly_recurring_revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get average_revenue_per_user() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get checkouts() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get succeeded_checkouts() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get churned_subscriptions() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get churn_rate() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get seats_total() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get seats_claimed() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get seats_pending() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get seat_customers() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get new_seat_customers() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get churned_seat_customers() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get orders() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get net_revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get cumulative_revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get net_cumulative_revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get costs() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get cumulative_costs() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get average_order_value() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get net_average_order_value() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get cost_per_user() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get active_user_by_event() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get one_time_products() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get one_time_products_revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get one_time_products_net_revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get new_subscriptions() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get new_subscriptions_revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get new_subscriptions_net_revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get renewed_subscriptions() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get renewed_subscriptions_revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get renewed_subscriptions_net_revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get canceled_subscriptions() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get canceled_subscriptions_customer_service() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get canceled_subscriptions_low_quality() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get canceled_subscriptions_missing_features() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get canceled_subscriptions_switched_service() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get canceled_subscriptions_too_complex() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get canceled_subscriptions_too_expensive() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get canceled_subscriptions_unused() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get canceled_subscriptions_other() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get annual_recurring_revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get committed_annual_recurring_revenue() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get checkouts_conversion() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get ltv() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get gross_margin() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get gross_margin_percentage() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get cashflow() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get average_seats_per_customer() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
  get seat_utilization_rate() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(Metric));
  },
});
export const MetricsIntervalLimit: ObjectSchema<models.MetricsIntervalLimit> =
  /* @__PURE__ */ z.looseObject({
    min_days: /* @__PURE__ */ z.int(),
    max_days: /* @__PURE__ */ z.int(),
  });
export const MetricsIntervalsLimits: ObjectSchema<models.MetricsIntervalsLimits> =
  /* @__PURE__ */ z.looseObject({
    get hour() {
      return MetricsIntervalLimit;
    },
    get day() {
      return MetricsIntervalLimit;
    },
    get week() {
      return MetricsIntervalLimit;
    },
    get month() {
      return MetricsIntervalLimit;
    },
    get year() {
      return MetricsIntervalLimit;
    },
  });
export const MetricsLimits: ObjectSchema<models.MetricsLimits> = /* @__PURE__ */ z.looseObject({
  min_date: /* @__PURE__ */ z.string(),
  get intervals() {
    return MetricsIntervalsLimits;
  },
});
export const MetricsResponse: ObjectSchema<models.MetricsResponse> = /* @__PURE__ */ z.looseObject({
  get periods() {
    return /* @__PURE__ */ z.array(MetricPeriod);
  },
  get totals() {
    return MetricsTotals;
  },
  get metrics() {
    return Metrics;
  },
});
export const MetricsTotals: ObjectSchema<models.MetricsTotals> = /* @__PURE__ */ z.looseObject({
  active_subscriptions: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  committed_subscriptions: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  monthly_recurring_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  trial_monthly_recurring_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  committed_monthly_recurring_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  trial_committed_monthly_recurring_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  average_revenue_per_user: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  checkouts: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  succeeded_checkouts: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  churned_subscriptions: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  churn_rate: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  seats_total: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  seats_claimed: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  seats_pending: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  seat_customers: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  new_seat_customers: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  churned_seat_customers: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  orders: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  net_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  cumulative_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  net_cumulative_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  costs: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  cumulative_costs: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  average_order_value: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  net_average_order_value: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  cost_per_user: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  active_user_by_event: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  one_time_products: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  one_time_products_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  one_time_products_net_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  new_subscriptions: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  new_subscriptions_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  new_subscriptions_net_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  renewed_subscriptions: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  renewed_subscriptions_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  renewed_subscriptions_net_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_customer_service: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_low_quality: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_missing_features: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_switched_service: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_too_complex: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_too_expensive: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_unused: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  canceled_subscriptions_other: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  annual_recurring_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  committed_annual_recurring_revenue: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  checkouts_conversion: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  ltv: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  gross_margin: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  gross_margin_percentage: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  cashflow: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  average_seats_per_customer: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
  seat_utilization_rate: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.number(),
      /* @__PURE__ */ z.null(),
    ]),
  ),
});
export const MissingInvoiceBillingDetails: ObjectSchema<models.MissingInvoiceBillingDetails> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("MissingInvoiceBillingDetails"),
    detail: /* @__PURE__ */ z.string(),
  });
export const NotOpenCheckout: ObjectSchema<models.NotOpenCheckout> = /* @__PURE__ */ z.looseObject({
  error: /* @__PURE__ */ z.literal("NotOpenCheckout"),
  detail: /* @__PURE__ */ z.string(),
});
export const NotPermitted: ObjectSchema<models.NotPermitted> = /* @__PURE__ */ z.looseObject({
  error: /* @__PURE__ */ z.literal("NotPermitted"),
  detail: /* @__PURE__ */ z.string(),
});
export const OAuth2ClientConfiguration: ObjectSchema<models.OAuth2ClientConfiguration> =
  /* @__PURE__ */ z.looseObject({
    redirect_uris: /* @__PURE__ */ z.array(/* @__PURE__ */ z.string()),
    token_endpoint_auth_method: /* @__PURE__ */ z.optional(TokenEndpointAuthMethod),
    grant_types: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.array(
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.literal("authorization_code"),
          /* @__PURE__ */ z.literal("refresh_token"),
        ]),
      ),
    ),
    response_types: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.array(/* @__PURE__ */ z.literal("code")),
    ),
    scope: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    client_name: /* @__PURE__ */ z.string(),
    client_uri: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    logo_uri: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    tos_uri: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    policy_uri: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    default_sub_type: /* @__PURE__ */ z.optional(SubType),
  });
export const OAuth2ClientConfigurationUpdate: ObjectSchema<models.OAuth2ClientConfigurationUpdate> =
  /* @__PURE__ */ z.looseObject({
    redirect_uris: /* @__PURE__ */ z.array(/* @__PURE__ */ z.string()),
    token_endpoint_auth_method: /* @__PURE__ */ z.optional(TokenEndpointAuthMethod),
    grant_types: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.array(
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.literal("authorization_code"),
          /* @__PURE__ */ z.literal("refresh_token"),
        ]),
      ),
    ),
    response_types: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.array(/* @__PURE__ */ z.literal("code")),
    ),
    scope: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    client_name: /* @__PURE__ */ z.string(),
    client_uri: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    logo_uri: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    tos_uri: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    policy_uri: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    default_sub_type: /* @__PURE__ */ z.optional(SubType),
    client_id: /* @__PURE__ */ z.string(),
  });
export const OAuth2ClientPublic: ObjectSchema<models.OAuth2ClientPublic> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    client_id: /* @__PURE__ */ z.string(),
    client_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    client_uri: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    logo_uri: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    tos_uri: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    policy_uri: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const OffSessionChargesNotEnabled: ObjectSchema<models.OffSessionChargesNotEnabled> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("OffSessionChargesNotEnabled"),
    detail: /* @__PURE__ */ z.string(),
  });
export const Order: ObjectSchema<models.Order> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  status: OrderStatus,
  paid: /* @__PURE__ */ z.boolean(),
  subtotal_amount: /* @__PURE__ */ z.int(),
  discount_amount: /* @__PURE__ */ z.int(),
  net_amount: /* @__PURE__ */ z.int(),
  tax_amount: /* @__PURE__ */ z.int(),
  total_amount: /* @__PURE__ */ z.int(),
  applied_balance_amount: /* @__PURE__ */ z.int(),
  due_amount: /* @__PURE__ */ z.int(),
  refunded_amount: /* @__PURE__ */ z.int(),
  refunded_tax_amount: /* @__PURE__ */ z.int(),
  currency: /* @__PURE__ */ z.string(),
  billing_reason: OrderBillingReason,
  billing_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get billing_address() {
    return /* @__PURE__ */ z.nullable(Address);
  },
  invoice_number: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  is_invoice_generated: /* @__PURE__ */ z.boolean(),
  receipt_number: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  customer_id: /* @__PURE__ */ z.string(),
  product_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  discount_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  checkout_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  next_payment_attempt_at: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  get metadata() {
    return MetadataOutputType;
  },
  custom_field_data: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.boolean(),
        /* @__PURE__ */ z.null(),
      ]),
    ),
  ),
  platform_fee_amount: /* @__PURE__ */ z.int(),
  platform_fee_currency: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get customer() {
    return OrderCustomer;
  },
  get product() {
    return /* @__PURE__ */ z.nullable(OrderProduct);
  },
  get discount() {
    return /* @__PURE__ */ z.nullable(
      /* @__PURE__ */ z.union([
        DiscountFixedOnceForeverDurationBase,
        DiscountFixedRepeatDurationBase,
        DiscountPercentageOnceForeverDurationBase,
        DiscountPercentageRepeatDurationBase,
      ]),
    );
  },
  get subscription() {
    return /* @__PURE__ */ z.nullable(OrderSubscription);
  },
  get items() {
    return /* @__PURE__ */ z.array(OrderItemSchema);
  },
  description: /* @__PURE__ */ z.string(),
  refundable_amount: /* @__PURE__ */ z.int(),
  refundable_tax_amount: /* @__PURE__ */ z.int(),
});
export const OrderCreate: ObjectSchema<models.OrderCreate> = /* @__PURE__ */ z.looseObject({
  custom_field_data: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.boolean(),
        /* @__PURE__ */ z.null(),
      ]),
    ),
  ),
  metadata: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.number(),
        /* @__PURE__ */ z.boolean(),
      ]),
    ),
  ),
  organization_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  customer_id: /* @__PURE__ */ z.string(),
  product_id: /* @__PURE__ */ z.string(),
  currency: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  units: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  description: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
});
export const OrderCustomer: ObjectSchema<models.OrderCustomer> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get metadata() {
    return MetadataOutputType;
  },
  external_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  email_verified: /* @__PURE__ */ z.boolean(),
  type: CustomerType,
  name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  billing_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get billing_address() {
    return /* @__PURE__ */ z.nullable(Address);
  },
  tax_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.unknown())),
  locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  organization_id: /* @__PURE__ */ z.string(),
  default_payment_method_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  deleted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  first_user_event_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  avatar_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
});
export const OrderFinalize: ObjectSchema<models.OrderFinalize> = /* @__PURE__ */ z.looseObject({
  payment_method_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
});
export const OrderInvoice: ObjectSchema<models.OrderInvoice> = /* @__PURE__ */ z.looseObject({
  url: /* @__PURE__ */ z.string(),
});
export const OrderItemSchema: ObjectSchema<models.OrderItemSchema> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  label: /* @__PURE__ */ z.string(),
  amount: /* @__PURE__ */ z.int(),
  tax_amount: /* @__PURE__ */ z.int(),
  proration: /* @__PURE__ */ z.boolean(),
  product_price_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  start_timestamp: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  end_timestamp: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
});
export const OrderNotDraft: ObjectSchema<models.OrderNotDraft> = /* @__PURE__ */ z.looseObject({
  error: /* @__PURE__ */ z.literal("OrderNotDraft"),
  detail: /* @__PURE__ */ z.string(),
});
export const OrderNotEligibleForInvoice: ObjectSchema<models.OrderNotEligibleForInvoice> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("OrderNotEligibleForInvoice"),
    detail: /* @__PURE__ */ z.string(),
  });
export const OrderNotEligibleForRetry: ObjectSchema<models.OrderNotEligibleForRetry> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("OrderNotEligibleForRetry"),
    detail: /* @__PURE__ */ z.string(),
  });
export const OrderPaidEvent: ObjectSchema<models.OrderPaidEvent> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  timestamp: /* @__PURE__ */ z.string(),
  organization_id: /* @__PURE__ */ z.string(),
  customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get customer() {
    return /* @__PURE__ */ z.nullable(Customer);
  },
  external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  external_member_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
  parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  label: /* @__PURE__ */ z.string(),
  source: /* @__PURE__ */ z.literal("system"),
  name: /* @__PURE__ */ z.literal("order.paid"),
  get metadata() {
    return OrderPaidMetadata;
  },
});
export const OrderPaidMetadata: ObjectSchema<models.OrderPaidMetadata> =
  /* @__PURE__ */ z.looseObject({
    order_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    billing_type: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    net_amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    tax_amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    applied_balance_amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    discount_amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    discount_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    platform_fee: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    subscription_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
  });
export const OrderProduct: ObjectSchema<models.OrderProduct> = /* @__PURE__ */ z.looseObject({
  get metadata() {
    return MetadataOutputType;
  },
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  trial_interval: /* @__PURE__ */ z.nullable(TrialInterval),
  trial_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  name: /* @__PURE__ */ z.string(),
  description: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  visibility: ProductVisibility,
  recurring_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
  recurring_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  meter_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
  meter_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  is_recurring: /* @__PURE__ */ z.boolean(),
  is_archived: /* @__PURE__ */ z.boolean(),
  organization_id: /* @__PURE__ */ z.string(),
});
export const OrderReceipt: ObjectSchema<models.OrderReceipt> = /* @__PURE__ */ z.looseObject({
  url: /* @__PURE__ */ z.string(),
});
export const OrderRefundedEvent: ObjectSchema<models.OrderRefundedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("order.refunded"),
    get metadata() {
      return OrderRefundedMetadata;
    },
  });
export const OrderRefundedMetadata: ObjectSchema<models.OrderRefundedMetadata> =
  /* @__PURE__ */ z.looseObject({
    order_id: /* @__PURE__ */ z.string(),
    refunded_amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
  });
export const OrderSubscription: ObjectSchema<models.OrderSubscription> =
  /* @__PURE__ */ z.looseObject({
    get metadata() {
      return MetadataOutputType;
    },
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    recurring_interval: RecurringInterval,
    recurring_interval_count: /* @__PURE__ */ z.int(),
    status: SubscriptionStatus,
    current_period_start: /* @__PURE__ */ z.string(),
    current_period_end: /* @__PURE__ */ z.string(),
    current_meter_period_start: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    current_meter_period_end: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    trial_start: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    trial_end: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    cancel_at_period_end: /* @__PURE__ */ z.boolean(),
    canceled_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    started_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ends_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ended_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    past_due_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    pause_at_period_end: /* @__PURE__ */ z.boolean(),
    paused_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    resumes_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    customer_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.string(),
    discount_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checkout_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    customer_cancellation_reason: /* @__PURE__ */ z.nullable(CustomerCancellationReason),
    customer_cancellation_comment: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const OrderUnvoidedEvent: ObjectSchema<models.OrderUnvoidedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("order.unvoided"),
    get metadata() {
      return OrderUnvoidedMetadata;
    },
  });
export const OrderUnvoidedMetadata: ObjectSchema<models.OrderUnvoidedMetadata> =
  /* @__PURE__ */ z.looseObject({
    order_id: /* @__PURE__ */ z.string(),
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
  });
export const OrderUpdate: ObjectSchema<models.OrderUpdate> = /* @__PURE__ */ z.looseObject({
  billing_name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  get billing_address() {
    return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(AddressInput));
  },
});
export const OrderVoidedEvent: ObjectSchema<models.OrderVoidedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("order.voided"),
    get metadata() {
      return OrderVoidedMetadata;
    },
  });
export const OrderVoidedMetadata: ObjectSchema<models.OrderVoidedMetadata> =
  /* @__PURE__ */ z.looseObject({
    order_id: /* @__PURE__ */ z.string(),
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
  });
export const Organization: ObjectSchema<models.Organization> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  name: /* @__PURE__ */ z.string(),
  slug: /* @__PURE__ */ z.string(),
  avatar_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  proration_behavior: SubscriptionProrationBehavior,
  allow_customer_updates: /* @__PURE__ */ z.boolean(),
  email: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  website: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get socials() {
    return /* @__PURE__ */ z.array(OrganizationSocialLink);
  },
  status: OrganizationStatus,
  details_submitted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  onboarding_resubmission_requested_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  sso_enforced: /* @__PURE__ */ z.boolean(),
  default_presentment_currency: /* @__PURE__ */ z.string(),
  default_tax_behavior: TaxBehaviorOption,
  get feature_settings() {
    return /* @__PURE__ */ z.nullable(OrganizationFeatureSettings);
  },
  get subscription_settings() {
    return OrganizationSubscriptionSettings;
  },
  get customer_email_settings() {
    return OrganizationCustomerEmailSettings;
  },
  get customer_portal_settings() {
    return OrganizationCustomerPortalSettings;
  },
  get dispute_settings() {
    return OrganizationDisputeSettings;
  },
  embed_hosts: /* @__PURE__ */ z.array(/* @__PURE__ */ z.string()),
  country: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(CountryAlpha2)),
  account_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  payout_account_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get capabilities() {
    return OrganizationCapabilities;
  },
});
export const OrganizationAvatarFileCreate: ObjectSchema<models.OrganizationAvatarFileCreate> =
  /* @__PURE__ */ z.looseObject({
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    name: /* @__PURE__ */ z.string(),
    mime_type: /* @__PURE__ */ z.string(),
    size: /* @__PURE__ */ z.int(),
    checksum_sha256_base64: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    get upload() {
      return S3FileCreateMultipart;
    },
    service: /* @__PURE__ */ z.literal("organization_avatar"),
    version: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const OrganizationAvatarFileRead: ObjectSchema<models.OrganizationAvatarFileRead> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    path: /* @__PURE__ */ z.string(),
    mime_type: /* @__PURE__ */ z.string(),
    size: /* @__PURE__ */ z.int(),
    storage_version: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checksum_etag: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checksum_sha256_base64: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checksum_sha256_hex: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    last_modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    version: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    service: /* @__PURE__ */ z.literal("organization_avatar"),
    is_uploaded: /* @__PURE__ */ z.boolean(),
    created_at: /* @__PURE__ */ z.string(),
    size_readable: /* @__PURE__ */ z.string(),
    public_url: /* @__PURE__ */ z.string(),
  });
export const OrganizationCapabilities: ObjectSchema<models.OrganizationCapabilities> =
  /* @__PURE__ */ z.looseObject({
    checkout_payments: /* @__PURE__ */ z.boolean(),
    subscription_renewals: /* @__PURE__ */ z.boolean(),
    payouts: /* @__PURE__ */ z.boolean(),
    refunds: /* @__PURE__ */ z.boolean(),
    api_access: /* @__PURE__ */ z.boolean(),
    dashboard_access: /* @__PURE__ */ z.boolean(),
  });
export const OrganizationCompanyLegalEntitySchema: ObjectSchema<models.OrganizationCompanyLegalEntitySchema> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("company"),
    registered_name: /* @__PURE__ */ z.string(),
  });
export const OrganizationCreate: ObjectSchema<models.OrganizationCreate> =
  /* @__PURE__ */ z.looseObject({
    name: /* @__PURE__ */ z.string(),
    slug: /* @__PURE__ */ z.string(),
    avatar_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    get legal_entity() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(
          /* @__PURE__ */ z.discriminatedUnion("type", [
            OrganizationIndividualLegalEntitySchema,
            OrganizationCompanyLegalEntitySchema,
          ]),
        ),
      );
    },
    email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    website: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    get socials() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(OrganizationSocialLink)),
      );
    },
    get details() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(OrganizationDetails));
    },
    country: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(CountryAlpha2Input)),
    get feature_settings() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(OrganizationFeatureSettingsUpdate),
      );
    },
    get subscription_settings() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(OrganizationSubscriptionSettings),
      );
    },
    get customer_email_settings() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(OrganizationCustomerEmailSettings),
      );
    },
    get customer_portal_settings() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(OrganizationCustomerPortalSettings),
      );
    },
    default_presentment_currency: /* @__PURE__ */ z.optional(PresentmentCurrency),
    default_tax_behavior: /* @__PURE__ */ z.optional(TaxBehaviorOption),
  });
export const OrganizationCustomerEmailSettings: ObjectSchema<models.OrganizationCustomerEmailSettings> =
  /* @__PURE__ */ z.looseObject({
    order_confirmation: /* @__PURE__ */ z.boolean(),
    payment_method_expiration_reminder: /* @__PURE__ */ z.boolean(),
    subscription_cancellation: /* @__PURE__ */ z.boolean(),
    subscription_confirmation: /* @__PURE__ */ z.boolean(),
    subscription_cycled: /* @__PURE__ */ z.boolean(),
    subscription_cycled_after_trial: /* @__PURE__ */ z.boolean(),
    subscription_past_due: /* @__PURE__ */ z.boolean(),
    subscription_paused: /* @__PURE__ */ z.boolean(),
    subscription_resumed: /* @__PURE__ */ z.boolean(),
    subscription_renewal_reminder: /* @__PURE__ */ z.boolean(),
    subscription_revoked: /* @__PURE__ */ z.boolean(),
    subscription_trial_conversion_reminder: /* @__PURE__ */ z.boolean(),
    subscription_uncanceled: /* @__PURE__ */ z.boolean(),
    subscription_updated: /* @__PURE__ */ z.boolean(),
  });
export const OrganizationCustomerPortalSettings: ObjectSchema<models.OrganizationCustomerPortalSettings> =
  /* @__PURE__ */ z.looseObject({
    get usage() {
      return CustomerPortalUsageSettings;
    },
    get subscription() {
      return CustomerPortalSubscriptionSettings;
    },
    get customer() {
      return /* @__PURE__ */ z.optional(CustomerPortalCustomerSettings);
    },
  });
export const OrganizationDetails: ObjectSchema<models.OrganizationDetails> =
  /* @__PURE__ */ z.looseObject({
    product_description: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    selling_categories: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.array(/* @__PURE__ */ z.string()),
    ),
    pricing_models: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
    switching: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    switching_from: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.literal("paddle"),
          /* @__PURE__ */ z.literal("lemon_squeezy"),
          /* @__PURE__ */ z.literal("gumroad"),
          /* @__PURE__ */ z.literal("stripe"),
          /* @__PURE__ */ z.literal("other"),
        ]),
      ),
    ),
    about: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    intended_use: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    customer_acquisition: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.array(/* @__PURE__ */ z.string()),
    ),
    future_annual_revenue: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
    previous_annual_revenue: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
  });
export const OrganizationDisputeSettings: ObjectSchema<models.OrganizationDisputeSettings> =
  /* @__PURE__ */ z.looseObject({
    auto_accept_below_amount: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  });
export const OrganizationDisputeSettingsUpdate: ObjectSchema<models.OrganizationDisputeSettingsUpdate> =
  /* @__PURE__ */ z.looseObject({
    auto_accept_below_amount: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
  });
export const OrganizationFeatureSettings: ObjectSchema<models.OrganizationFeatureSettings> =
  /* @__PURE__ */ z.looseObject({
    issue_funding_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    wallets_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    member_model_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    checkout_localization_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    overview_metrics: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
    ),
    reset_proration_behavior_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    off_session_charges_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    meter_cycling_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    slack_benefit_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    preview_access_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    disputes_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    sso_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    dispute_auto_accept_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    compass_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    merchant_migration_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
  });
export const OrganizationFeatureSettingsUpdate: ObjectSchema<models.OrganizationFeatureSettingsUpdate> =
  /* @__PURE__ */ z.looseObject({
    member_model_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    checkout_localization_enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
    overview_metrics: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
    ),
  });
export const OrganizationIndividualLegalEntitySchema: ObjectSchema<models.OrganizationIndividualLegalEntitySchema> =
  /* @__PURE__ */ z.looseObject({ type: /* @__PURE__ */ z.literal("individual") });
export const OrganizationNotReadyForPayments: ObjectSchema<models.OrganizationNotReadyForPayments> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("OrganizationNotReadyForPayments"),
    detail: /* @__PURE__ */ z.string(),
  });
export const OrganizationSocialLink: ObjectSchema<models.OrganizationSocialLink> =
  /* @__PURE__ */ z.looseObject({
    platform: OrganizationSocialPlatforms,
    url: /* @__PURE__ */ z.string(),
  });
export const OrganizationSubscriptionSettings: ObjectSchema<models.OrganizationSubscriptionSettings> =
  /* @__PURE__ */ z.looseObject({
    allow_multiple_subscriptions: /* @__PURE__ */ z.boolean(),
    proration_behavior: PublicSubscriptionProrationBehavior,
    benefit_revocation_grace_period: /* @__PURE__ */ z.int(),
    prevent_trial_abuse: /* @__PURE__ */ z.boolean(),
    allow_customer_updates: /* @__PURE__ */ z.boolean(),
  });
export const OrganizationUpdate: ObjectSchema<models.OrganizationUpdate> =
  /* @__PURE__ */ z.looseObject({
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    avatar_url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    website: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    get socials() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(OrganizationSocialLink)),
      );
    },
    get details() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(OrganizationDetails));
    },
    country: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(CountryAlpha2Input)),
    get feature_settings() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(OrganizationFeatureSettingsUpdate),
      );
    },
    get subscription_settings() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(OrganizationSubscriptionSettings),
      );
    },
    get customer_email_settings() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(OrganizationCustomerEmailSettings),
      );
    },
    get customer_portal_settings() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(OrganizationCustomerPortalSettings),
      );
    },
    get dispute_settings() {
      return /* @__PURE__ */ z.optional(
        /* @__PURE__ */ z.nullable(OrganizationDisputeSettingsUpdate),
      );
    },
    embed_hosts: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
    ),
    default_presentment_currency: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(PresentmentCurrency),
    ),
    default_tax_behavior: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(TaxBehaviorOption)),
    sso_enforced: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean()),
    ),
  });
export const Pagination: ObjectSchema<models.Pagination> = /* @__PURE__ */ z.looseObject({
  total_count: /* @__PURE__ */ z.int(),
  max_page: /* @__PURE__ */ z.int(),
});
export const PauseResumeNotAllowed: ObjectSchema<models.PauseResumeNotAllowed> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("PauseResumeNotAllowed"),
    detail: /* @__PURE__ */ z.string(),
  });
export const PaymentActionRequired: ObjectSchema<models.PaymentActionRequired> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("PaymentActionRequired"),
    detail: /* @__PURE__ */ z.string(),
  });
export const PaymentAlreadyInProgress: ObjectSchema<models.PaymentAlreadyInProgress> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("PaymentAlreadyInProgress"),
    detail: /* @__PURE__ */ z.string(),
  });
export const PaymentError: ObjectSchema<models.PaymentError> = /* @__PURE__ */ z.looseObject({
  error: /* @__PURE__ */ z.literal("PaymentError"),
  detail: /* @__PURE__ */ z.string(),
});
export const PaymentFailed: ObjectSchema<models.PaymentFailed> = /* @__PURE__ */ z.looseObject({
  error: /* @__PURE__ */ z.literal("PaymentFailed"),
  detail: /* @__PURE__ */ z.string(),
});
export const PaymentMethodCard: ObjectSchema<models.PaymentMethodCard> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    processor: PaymentProcessor,
    customer_id: /* @__PURE__ */ z.string(),
    type: /* @__PURE__ */ z.literal("card"),
    get method_metadata() {
      return PaymentMethodCardMetadata;
    },
  });
export const PaymentMethodCardMetadata: ObjectSchema<models.PaymentMethodCardMetadata> =
  /* @__PURE__ */ z.looseObject({
    brand: /* @__PURE__ */ z.string(),
    last4: /* @__PURE__ */ z.string(),
    exp_month: /* @__PURE__ */ z.int(),
    exp_year: /* @__PURE__ */ z.int(),
    wallet: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const PaymentMethodGeneric: ObjectSchema<models.PaymentMethodGeneric> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    processor: PaymentProcessor,
    customer_id: /* @__PURE__ */ z.string(),
    type: /* @__PURE__ */ z.string(),
  });
export const PaymentMethodInUseByActiveSubscription: ObjectSchema<models.PaymentMethodInUseByActiveSubscription> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("PaymentMethodInUseByActiveSubscription"),
    detail: /* @__PURE__ */ z.string(),
  });
export const PaymentMethodKrCard: ObjectSchema<models.PaymentMethodKrCard> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    processor: PaymentProcessor,
    customer_id: /* @__PURE__ */ z.string(),
    type: /* @__PURE__ */ z.literal("kr_card"),
    get method_metadata() {
      return PaymentMethodKrCardMetadata;
    },
  });
export const PaymentMethodKrCardMetadata: ObjectSchema<models.PaymentMethodKrCardMetadata> =
  /* @__PURE__ */ z.looseObject({
    brand: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    last4: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const PaymentMethodRequired: ObjectSchema<models.PaymentMethodRequired> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("PaymentMethodRequired"),
    detail: /* @__PURE__ */ z.string(),
  });
export const PaymentMethodSetupFailed: ObjectSchema<models.PaymentMethodSetupFailed> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("PaymentMethodSetupFailed"),
    detail: /* @__PURE__ */ z.string(),
  });
export const PaymentNotReady: ObjectSchema<models.PaymentNotReady> = /* @__PURE__ */ z.looseObject({
  error: /* @__PURE__ */ z.literal("PaymentNotReady"),
  detail: /* @__PURE__ */ z.string(),
});
export const PendingSubscriptionUpdate: ObjectSchema<models.PendingSubscriptionUpdate> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    applies_at: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    seats: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  });
export const PortalAuthenticatedUser: ObjectSchema<models.PortalAuthenticatedUser> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    email: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.string(),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    role: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const Product: ObjectSchema<models.Product> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  trial_interval: /* @__PURE__ */ z.nullable(TrialInterval),
  trial_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  name: /* @__PURE__ */ z.string(),
  description: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  visibility: ProductVisibility,
  recurring_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
  recurring_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  meter_interval: /* @__PURE__ */ z.nullable(RecurringInterval),
  meter_interval_count: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  is_recurring: /* @__PURE__ */ z.boolean(),
  is_archived: /* @__PURE__ */ z.boolean(),
  organization_id: /* @__PURE__ */ z.string(),
  get metadata() {
    return MetadataOutputType;
  },
  is_deletable: /* @__PURE__ */ z.boolean(),
  get prices() {
    return /* @__PURE__ */ z.array(
      /* @__PURE__ */ z.union([LegacyRecurringProductPrice, ProductPrice]),
    );
  },
  get benefits() {
    return /* @__PURE__ */ z.array(Benefit);
  },
  get medias() {
    return /* @__PURE__ */ z.array(ProductMediaFileRead);
  },
  get attached_custom_fields() {
    return /* @__PURE__ */ z.array(AttachedCustomField);
  },
});
export const ProductBenefitsUpdate: ObjectSchema<models.ProductBenefitsUpdate> =
  /* @__PURE__ */ z.looseObject({ benefits: /* @__PURE__ */ z.array(/* @__PURE__ */ z.string()) });
export const ProductCreateOneTime: ObjectSchema<models.ProductCreateOneTime> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    name: /* @__PURE__ */ z.string(),
    description: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    visibility: /* @__PURE__ */ z.optional(ProductVisibility),
    get prices() {
      return /* @__PURE__ */ z.array(
        /* @__PURE__ */ z.discriminatedUnion("amount_type", [
          ProductPriceFixedCreate,
          ProductPriceCustomCreate,
          ProductPriceSeatBasedCreate,
          ProductPriceUnitBasedCreate,
          ProductPriceMeteredUnitCreate,
          ProductPriceMeteredTiersCreate,
        ]),
      );
    },
    medias: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
    ),
    get attached_custom_fields() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.array(AttachedCustomFieldCreate));
    },
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    recurring_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.null()),
    recurring_interval_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.null()),
  });
export const ProductCreateRecurring: ObjectSchema<models.ProductCreateRecurring> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    name: /* @__PURE__ */ z.string(),
    description: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    visibility: /* @__PURE__ */ z.optional(ProductVisibility),
    get prices() {
      return /* @__PURE__ */ z.array(
        /* @__PURE__ */ z.discriminatedUnion("amount_type", [
          ProductPriceFixedCreate,
          ProductPriceCustomCreate,
          ProductPriceSeatBasedCreate,
          ProductPriceUnitBasedCreate,
          ProductPriceMeteredUnitCreate,
          ProductPriceMeteredTiersCreate,
        ]),
      );
    },
    medias: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
    ),
    get attached_custom_fields() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.array(AttachedCustomFieldCreate));
    },
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    trial_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(TrialInterval)),
    trial_interval_count: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
    recurring_interval: RecurringInterval,
    recurring_interval_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    meter_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(RecurringInterval)),
    meter_interval_count: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    ),
  });
export const ProductMediaFileCreate: ObjectSchema<models.ProductMediaFileCreate> =
  /* @__PURE__ */ z.looseObject({
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    name: /* @__PURE__ */ z.string(),
    mime_type: /* @__PURE__ */ z.string(),
    size: /* @__PURE__ */ z.int(),
    checksum_sha256_base64: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    get upload() {
      return S3FileCreateMultipart;
    },
    service: /* @__PURE__ */ z.literal("product_media"),
    version: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const ProductMediaFileRead: ObjectSchema<models.ProductMediaFileRead> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    path: /* @__PURE__ */ z.string(),
    mime_type: /* @__PURE__ */ z.string(),
    size: /* @__PURE__ */ z.int(),
    storage_version: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checksum_etag: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checksum_sha256_base64: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checksum_sha256_hex: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    last_modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    version: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    service: /* @__PURE__ */ z.literal("product_media"),
    is_uploaded: /* @__PURE__ */ z.boolean(),
    created_at: /* @__PURE__ */ z.string(),
    size_readable: /* @__PURE__ */ z.string(),
    public_url: /* @__PURE__ */ z.string(),
  });
export const ProductNotDeletable: ObjectSchema<models.ProductNotDeletable> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("ProductNotDeletable"),
    detail: /* @__PURE__ */ z.string(),
  });
export const ProductPriceCustom: ObjectSchema<models.ProductPriceCustom> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    source: ProductPriceSource,
    amount_type: /* @__PURE__ */ z.literal("custom"),
    price_currency: /* @__PURE__ */ z.string(),
    tax_behavior: /* @__PURE__ */ z.nullable(TaxBehaviorOption),
    is_archived: /* @__PURE__ */ z.boolean(),
    product_id: /* @__PURE__ */ z.string(),
    minimum_amount: /* @__PURE__ */ z.int(),
    maximum_amount: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    preset_amount: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  });
export const ProductPriceCustomCreate: ObjectSchema<models.ProductPriceCustomCreate> =
  /* @__PURE__ */ z.looseObject({
    amount_type: /* @__PURE__ */ z.literal("custom"),
    price_currency: /* @__PURE__ */ z.optional(PresentmentCurrency),
    tax_behavior: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(TaxBehaviorOption)),
    minimum_amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    maximum_amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    preset_amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  });
export const ProductPriceFixed: ObjectSchema<models.ProductPriceFixed> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    source: ProductPriceSource,
    amount_type: /* @__PURE__ */ z.literal("fixed"),
    price_currency: /* @__PURE__ */ z.string(),
    tax_behavior: /* @__PURE__ */ z.nullable(TaxBehaviorOption),
    is_archived: /* @__PURE__ */ z.boolean(),
    product_id: /* @__PURE__ */ z.string(),
    price_amount: /* @__PURE__ */ z.int(),
  });
export const ProductPriceFixedCreate: ObjectSchema<models.ProductPriceFixedCreate> =
  /* @__PURE__ */ z.looseObject({
    amount_type: /* @__PURE__ */ z.literal("fixed"),
    price_currency: /* @__PURE__ */ z.optional(PresentmentCurrency),
    tax_behavior: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(TaxBehaviorOption)),
    price_amount: /* @__PURE__ */ z.int(),
  });
export const ProductPriceMeter: ObjectSchema<models.ProductPriceMeter> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    unit: MeterUnit,
    custom_label: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    custom_multiplier: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  });
export const ProductPriceMeteredTiers: ObjectSchema<models.ProductPriceMeteredTiers> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    source: ProductPriceSource,
    amount_type: /* @__PURE__ */ z.literal("metered_tiers"),
    price_currency: /* @__PURE__ */ z.string(),
    tax_behavior: /* @__PURE__ */ z.nullable(TaxBehaviorOption),
    is_archived: /* @__PURE__ */ z.boolean(),
    product_id: /* @__PURE__ */ z.string(),
    cap_amount: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    meter_id: /* @__PURE__ */ z.string(),
    get meter() {
      return ProductPriceMeter;
    },
    get tiers() {
      return Tiers;
    },
  });
export const ProductPriceMeteredTiersCreate: ObjectSchema<models.ProductPriceMeteredTiersCreate> =
  /* @__PURE__ */ z.looseObject({
    amount_type: /* @__PURE__ */ z.literal("metered_tiers"),
    price_currency: /* @__PURE__ */ z.optional(PresentmentCurrency),
    tax_behavior: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(TaxBehaviorOption)),
    meter_id: /* @__PURE__ */ z.string(),
    get tiers() {
      return TiersInput;
    },
    cap_amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  });
export const ProductPriceMeteredUnit: ObjectSchema<models.ProductPriceMeteredUnit> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    source: ProductPriceSource,
    amount_type: /* @__PURE__ */ z.literal("metered_unit"),
    price_currency: /* @__PURE__ */ z.string(),
    tax_behavior: /* @__PURE__ */ z.nullable(TaxBehaviorOption),
    is_archived: /* @__PURE__ */ z.boolean(),
    product_id: /* @__PURE__ */ z.string(),
    cap_amount: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    meter_id: /* @__PURE__ */ z.string(),
    get meter() {
      return ProductPriceMeter;
    },
    unit_amount: /* @__PURE__ */ z.string(),
  });
export const ProductPriceMeteredUnitCreate: ObjectSchema<models.ProductPriceMeteredUnitCreate> =
  /* @__PURE__ */ z.looseObject({
    amount_type: /* @__PURE__ */ z.literal("metered_unit"),
    price_currency: /* @__PURE__ */ z.optional(PresentmentCurrency),
    tax_behavior: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(TaxBehaviorOption)),
    meter_id: /* @__PURE__ */ z.string(),
    unit_amount: /* @__PURE__ */ z.union([/* @__PURE__ */ z.number(), /* @__PURE__ */ z.string()]),
    cap_amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  });
export const ProductPriceSeatBased: ObjectSchema<models.ProductPriceSeatBased> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    source: ProductPriceSource,
    amount_type: /* @__PURE__ */ z.literal("seat_based"),
    price_currency: /* @__PURE__ */ z.string(),
    tax_behavior: /* @__PURE__ */ z.nullable(TaxBehaviorOption),
    is_archived: /* @__PURE__ */ z.boolean(),
    product_id: /* @__PURE__ */ z.string(),
    get seat_tiers() {
      return ProductPriceSeatTiersOutput;
    },
  });
export const ProductPriceSeatBasedCreate: ObjectSchema<models.ProductPriceSeatBasedCreate> =
  /* @__PURE__ */ z.looseObject({
    amount_type: /* @__PURE__ */ z.literal("seat_based"),
    price_currency: /* @__PURE__ */ z.optional(PresentmentCurrency),
    tax_behavior: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(TaxBehaviorOption)),
    get seat_tiers() {
      return ProductPriceSeatTiersInput;
    },
  });
export const ProductPriceSeatTier: ObjectSchema<models.ProductPriceSeatTier> =
  /* @__PURE__ */ z.looseObject({
    min_seats: /* @__PURE__ */ z.int(),
    max_seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    price_per_seat: /* @__PURE__ */ z.int(),
  });
export const ProductPriceSeatTiersInput: ObjectSchema<models.ProductPriceSeatTiersInput> =
  /* @__PURE__ */ z.looseObject({
    seat_tier_type: /* @__PURE__ */ z.optional(SeatTierType),
    get tiers() {
      return /* @__PURE__ */ z.array(ProductPriceSeatTier);
    },
  });
export const ProductPriceSeatTiersOutput: ObjectSchema<models.ProductPriceSeatTiersOutput> =
  /* @__PURE__ */ z.looseObject({
    seat_tier_type: /* @__PURE__ */ z.optional(SeatTierType),
    get tiers() {
      return /* @__PURE__ */ z.array(ProductPriceSeatTier);
    },
    minimum_seats: /* @__PURE__ */ z.int(),
    maximum_seats: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  });
export const ProductPriceUnitBased: ObjectSchema<models.ProductPriceUnitBased> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    source: ProductPriceSource,
    amount_type: /* @__PURE__ */ z.literal("unit_based"),
    price_currency: /* @__PURE__ */ z.string(),
    tax_behavior: /* @__PURE__ */ z.nullable(TaxBehaviorOption),
    is_archived: /* @__PURE__ */ z.boolean(),
    product_id: /* @__PURE__ */ z.string(),
    get tiers() {
      return Tiers;
    },
    minimum_units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    unit_label: /* @__PURE__ */ z.nullable(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.string()),
      ),
    ),
    maximum_units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  });
export const ProductPriceUnitBasedCreate: ObjectSchema<models.ProductPriceUnitBasedCreate> =
  /* @__PURE__ */ z.looseObject({
    amount_type: /* @__PURE__ */ z.literal("unit_based"),
    price_currency: /* @__PURE__ */ z.optional(PresentmentCurrency),
    tax_behavior: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(TaxBehaviorOption)),
    get tiers() {
      return TiersInput;
    },
    minimum_units: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
    unit_label: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(
        /* @__PURE__ */ z.record(
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.string()),
        ),
      ),
    ),
  });
export const ProductUpdate: ObjectSchema<models.ProductUpdate> = /* @__PURE__ */ z.looseObject({
  metadata: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.number(),
        /* @__PURE__ */ z.boolean(),
      ]),
    ),
  ),
  trial_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(TrialInterval)),
  trial_interval_count: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  ),
  name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  description: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  recurring_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(RecurringInterval)),
  recurring_interval_count: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  ),
  is_archived: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean())),
  visibility: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(ProductVisibility)),
  get prices() {
    return /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(
        /* @__PURE__ */ z.array(
          /* @__PURE__ */ z.union([
            ExistingProductPrice,
            /* @__PURE__ */ z.discriminatedUnion("amount_type", [
              ProductPriceFixedCreate,
              ProductPriceCustomCreate,
              ProductPriceSeatBasedCreate,
              ProductPriceUnitBasedCreate,
              ProductPriceMeteredUnitCreate,
              ProductPriceMeteredTiersCreate,
            ]),
          ]),
        ),
      ),
    );
  },
  medias: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.string())),
  ),
  get attached_custom_fields() {
    return /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(AttachedCustomFieldCreate)),
    );
  },
});
export const PropertyAggregation: ObjectSchema<models.PropertyAggregation> =
  /* @__PURE__ */ z.looseObject({ func: Func, property: /* @__PURE__ */ z.string() });
export const Refund: ObjectSchema<models.Refund> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  get metadata() {
    return MetadataOutputType;
  },
  status: RefundStatus,
  reason: RefundReason,
  amount: /* @__PURE__ */ z.int(),
  tax_amount: /* @__PURE__ */ z.int(),
  currency: /* @__PURE__ */ z.string(),
  organization_id: /* @__PURE__ */ z.string(),
  order_id: /* @__PURE__ */ z.string(),
  subscription_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  customer_id: /* @__PURE__ */ z.string(),
  revoke_benefits: /* @__PURE__ */ z.boolean(),
  get dispute() {
    return /* @__PURE__ */ z.nullable(RefundDispute);
  },
});
export const RefundCreate: ObjectSchema<models.RefundCreate> = /* @__PURE__ */ z.looseObject({
  metadata: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.number(),
        /* @__PURE__ */ z.boolean(),
      ]),
    ),
  ),
  order_id: /* @__PURE__ */ z.string(),
  reason: Reason,
  amount: /* @__PURE__ */ z.int(),
  comment: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  revoke_benefits: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
});
export const RefundDispute: ObjectSchema<models.RefundDispute> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  status: DisputeStatus,
  resolved: /* @__PURE__ */ z.boolean(),
  closed: /* @__PURE__ */ z.boolean(),
  amount: /* @__PURE__ */ z.int(),
  tax_amount: /* @__PURE__ */ z.int(),
  currency: /* @__PURE__ */ z.string(),
  reason: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  evidence_due_by: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  past_due: /* @__PURE__ */ z.boolean(),
  order_id: /* @__PURE__ */ z.string(),
  payment_id: /* @__PURE__ */ z.string(),
});
export const RefundedAlready: ObjectSchema<models.RefundedAlready> = /* @__PURE__ */ z.looseObject({
  error: /* @__PURE__ */ z.literal("RefundedAlready"),
  detail: /* @__PURE__ */ z.string(),
});
export const ResourceNotFound: ObjectSchema<models.ResourceNotFound> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("ResourceNotFound"),
    detail: /* @__PURE__ */ z.string(),
  });
export const RevokeTokenResponse: ObjectSchema<models.RevokeTokenResponse> =
  /* @__PURE__ */ z.looseObject({}) as never;
export const RotateNotPermitted: ObjectSchema<models.RotateNotPermitted> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("RotateNotPermitted"),
    detail: /* @__PURE__ */ z.string(),
  });
export const RotatedLicenseKey: ObjectSchema<models.RotatedLicenseKey> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.string(),
    get customer() {
      return LicenseKeyCustomer;
    },
    member_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get member() {
      return /* @__PURE__ */ z.nullable(LicenseKeyMember);
    },
    benefit_id: /* @__PURE__ */ z.string(),
    key: /* @__PURE__ */ z.string(),
    display_key: /* @__PURE__ */ z.string(),
    status: Status,
    limit_activations: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    usage: /* @__PURE__ */ z.int(),
    limit_usage: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    validations: /* @__PURE__ */ z.int(),
    last_validated_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    expires_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const S3DownloadURL: ObjectSchema<models.S3DownloadURL> = /* @__PURE__ */ z.looseObject({
  url: /* @__PURE__ */ z.string(),
  headers: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.string()),
  ),
  expires_at: /* @__PURE__ */ z.string(),
});
export const S3FileCreateMultipart: ObjectSchema<models.S3FileCreateMultipart> =
  /* @__PURE__ */ z.looseObject({
    get parts() {
      return /* @__PURE__ */ z.array(S3FileCreatePart);
    },
  });
export const S3FileCreatePart: ObjectSchema<models.S3FileCreatePart> =
  /* @__PURE__ */ z.looseObject({
    number: /* @__PURE__ */ z.int(),
    chunk_start: /* @__PURE__ */ z.int(),
    chunk_end: /* @__PURE__ */ z.int(),
    checksum_sha256_base64: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
  });
export const S3FileUploadCompletedPart: ObjectSchema<models.S3FileUploadCompletedPart> =
  /* @__PURE__ */ z.looseObject({
    number: /* @__PURE__ */ z.int(),
    checksum_etag: /* @__PURE__ */ z.string(),
    checksum_sha256_base64: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const S3FileUploadMultipart: ObjectSchema<models.S3FileUploadMultipart> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    path: /* @__PURE__ */ z.string(),
    get parts() {
      return /* @__PURE__ */ z.array(S3FileUploadPart);
    },
  });
export const S3FileUploadPart: ObjectSchema<models.S3FileUploadPart> =
  /* @__PURE__ */ z.looseObject({
    number: /* @__PURE__ */ z.int(),
    chunk_start: /* @__PURE__ */ z.int(),
    chunk_end: /* @__PURE__ */ z.int(),
    checksum_sha256_base64: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    url: /* @__PURE__ */ z.string(),
    expires_at: /* @__PURE__ */ z.string(),
    headers: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.string()),
    ),
  });
export const SSOEnforcementRequiresConnection: ObjectSchema<models.SSOEnforcementRequiresConnection> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("SSOEnforcementRequiresConnection"),
    detail: /* @__PURE__ */ z.string(),
  });
export const SeatAssign: ObjectSchema<models.SeatAssign> = /* @__PURE__ */ z.looseObject({
  subscription_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  order_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  external_customer_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  customer_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  external_member_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  metadata: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(
      /* @__PURE__ */ z.record(/* @__PURE__ */ z.string(), /* @__PURE__ */ z.unknown()),
    ),
  ),
  immediate_claim: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
});
export const SeatClaim: ObjectSchema<models.SeatClaim> = /* @__PURE__ */ z.looseObject({
  invitation_token: /* @__PURE__ */ z.string(),
});
export const SeatClaimInfo: ObjectSchema<models.SeatClaimInfo> = /* @__PURE__ */ z.looseObject({
  product_name: /* @__PURE__ */ z.string(),
  product_id: /* @__PURE__ */ z.string(),
  organization_name: /* @__PURE__ */ z.string(),
  organization_slug: /* @__PURE__ */ z.string(),
  customer_email: /* @__PURE__ */ z.string(),
  can_claim: /* @__PURE__ */ z.boolean(),
});
export const SeatsList: ObjectSchema<models.SeatsList> = /* @__PURE__ */ z.looseObject({
  get seats() {
    return /* @__PURE__ */ z.array(CustomerSeat);
  },
  available_seats: /* @__PURE__ */ z.int(),
  total_seats: /* @__PURE__ */ z.int(),
});
export const Subscription: ObjectSchema<models.Subscription> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  amount: /* @__PURE__ */ z.int(),
  currency: /* @__PURE__ */ z.string(),
  recurring_interval: RecurringInterval,
  recurring_interval_count: /* @__PURE__ */ z.int(),
  status: SubscriptionStatus,
  current_period_start: /* @__PURE__ */ z.string(),
  current_period_end: /* @__PURE__ */ z.string(),
  current_meter_period_start: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  current_meter_period_end: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  trial_start: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  trial_end: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  cancel_at_period_end: /* @__PURE__ */ z.boolean(),
  canceled_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  started_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ends_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ended_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  past_due_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  pause_at_period_end: /* @__PURE__ */ z.boolean(),
  paused_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  resumes_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  customer_id: /* @__PURE__ */ z.string(),
  product_id: /* @__PURE__ */ z.string(),
  discount_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  checkout_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  units: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  customer_cancellation_reason: /* @__PURE__ */ z.nullable(CustomerCancellationReason),
  customer_cancellation_comment: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get metadata() {
    return MetadataOutputType;
  },
  custom_field_data: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.record(
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.int(),
        /* @__PURE__ */ z.boolean(),
        /* @__PURE__ */ z.null(),
      ]),
    ),
  ),
  get customer() {
    return SubscriptionCustomer;
  },
  get product() {
    return Product;
  },
  get discount() {
    return /* @__PURE__ */ z.nullable(
      /* @__PURE__ */ z.union([
        DiscountFixedOnceForeverDurationBase,
        DiscountFixedRepeatDurationBase,
        DiscountPercentageOnceForeverDurationBase,
        DiscountPercentageRepeatDurationBase,
      ]),
    );
  },
  get prices() {
    return /* @__PURE__ */ z.array(
      /* @__PURE__ */ z.union([LegacyRecurringProductPrice, ProductPrice]),
    );
  },
  get meters() {
    return /* @__PURE__ */ z.array(SubscriptionMeter);
  },
  get pending_update() {
    return /* @__PURE__ */ z.nullable(PendingSubscriptionUpdate);
  },
});
export const SubscriptionBillingPeriodUpdatedEvent: ObjectSchema<models.SubscriptionBillingPeriodUpdatedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.billing_period_updated"),
    get metadata() {
      return SubscriptionBillingPeriodUpdatedMetadata;
    },
  });
export const SubscriptionBillingPeriodUpdatedMetadata: ObjectSchema<models.SubscriptionBillingPeriodUpdatedMetadata> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.string(),
    old_period_end: /* @__PURE__ */ z.string(),
    new_period_end: /* @__PURE__ */ z.string(),
  });
export const SubscriptionCancel: ObjectSchema<models.SubscriptionCancel> =
  /* @__PURE__ */ z.looseObject({
    customer_cancellation_reason: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(CustomerCancellationReason),
    ),
    customer_cancellation_comment: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    cancel_at_period_end: /* @__PURE__ */ z.boolean(),
  });
export const SubscriptionCanceledEvent: ObjectSchema<models.SubscriptionCanceledEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.canceled"),
    get metadata() {
      return SubscriptionCanceledMetadata;
    },
  });
export const SubscriptionCanceledMetadata: ObjectSchema<models.SubscriptionCanceledMetadata> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    recurring_interval: /* @__PURE__ */ z.string(),
    recurring_interval_count: /* @__PURE__ */ z.int(),
    customer_cancellation_reason: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    customer_cancellation_comment: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    canceled_at: /* @__PURE__ */ z.string(),
    ends_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    cancel_at_period_end: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.boolean()),
  });
export const SubscriptionCreateCustomer: ObjectSchema<models.SubscriptionCreateCustomer> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    product_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.string(),
  });
export const SubscriptionCreateExternalCustomer: ObjectSchema<models.SubscriptionCreateExternalCustomer> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    product_id: /* @__PURE__ */ z.string(),
    external_customer_id: /* @__PURE__ */ z.string(),
  });
export const SubscriptionCreatedEvent: ObjectSchema<models.SubscriptionCreatedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.created"),
    get metadata() {
      return SubscriptionCreatedMetadata;
    },
  });
export const SubscriptionCreatedMetadata: ObjectSchema<models.SubscriptionCreatedMetadata> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.string(),
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    recurring_interval: /* @__PURE__ */ z.string(),
    recurring_interval_count: /* @__PURE__ */ z.int(),
    started_at: /* @__PURE__ */ z.string(),
  });
export const SubscriptionCustomer: ObjectSchema<models.SubscriptionCustomer> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get metadata() {
      return MetadataOutputType;
    },
    external_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    email_verified: /* @__PURE__ */ z.boolean(),
    type: CustomerType,
    name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    billing_name: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get billing_address() {
      return /* @__PURE__ */ z.nullable(Address);
    },
    tax_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(/* @__PURE__ */ z.unknown())),
    locale: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    organization_id: /* @__PURE__ */ z.string(),
    default_payment_method_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    deleted_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    first_user_event_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    avatar_url: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  });
export const SubscriptionCycledEvent: ObjectSchema<models.SubscriptionCycledEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.cycled"),
    get metadata() {
      return SubscriptionCycledMetadata;
    },
  });
export const SubscriptionCycledMetadata: ObjectSchema<models.SubscriptionCycledMetadata> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    currency: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
  });
export const SubscriptionLocked: ObjectSchema<models.SubscriptionLocked> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("SubscriptionLocked"),
    detail: /* @__PURE__ */ z.string(),
  });
export const SubscriptionMeter: ObjectSchema<models.SubscriptionMeter> =
  /* @__PURE__ */ z.looseObject({
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    id: /* @__PURE__ */ z.string(),
    consumed_units: /* @__PURE__ */ z.number(),
    credited_units: /* @__PURE__ */ z.int(),
    amount: /* @__PURE__ */ z.int(),
    meter_id: /* @__PURE__ */ z.string(),
    get meter() {
      return Meter;
    },
  });
export const SubscriptionMigratedEvent: ObjectSchema<models.SubscriptionMigratedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.migrated"),
    get metadata() {
      return SubscriptionMigratedMetadata;
    },
  });
export const SubscriptionMigratedMetadata: ObjectSchema<models.SubscriptionMigratedMetadata> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.string(),
    provider: /* @__PURE__ */ z.string(),
    provider_subscription_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.string(),
  });
export const SubscriptionNotScheduledToCancel: ObjectSchema<models.SubscriptionNotScheduledToCancel> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("SubscriptionNotScheduledToCancel"),
    detail: /* @__PURE__ */ z.string(),
  });
export const SubscriptionPastDueEvent: ObjectSchema<models.SubscriptionPastDueEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.past_due"),
    get metadata() {
      return SubscriptionPastDueMetadata;
    },
  });
export const SubscriptionPastDueMetadata: ObjectSchema<models.SubscriptionPastDueMetadata> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    past_due_at: /* @__PURE__ */ z.string(),
    amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    currency: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
  });
export const SubscriptionPause: ObjectSchema<models.SubscriptionPause> =
  /* @__PURE__ */ z.looseObject({
    pause_at_period_end: /* @__PURE__ */ z.boolean(),
    resumes_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const SubscriptionPausedEvent: ObjectSchema<models.SubscriptionPausedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.paused"),
    get metadata() {
      return SubscriptionPausedMetadata;
    },
  });
export const SubscriptionPausedMetadata: ObjectSchema<models.SubscriptionPausedMetadata> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    currency: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    paused_at: /* @__PURE__ */ z.string(),
    resumes_at: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
  });
export const SubscriptionProductUpdatedEvent: ObjectSchema<models.SubscriptionProductUpdatedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.product_updated"),
    get metadata() {
      return SubscriptionProductUpdatedMetadata;
    },
  });
export const SubscriptionProductUpdatedMetadata: ObjectSchema<models.SubscriptionProductUpdatedMetadata> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.string(),
    old_product_id: /* @__PURE__ */ z.string(),
    new_product_id: /* @__PURE__ */ z.string(),
  });
export const SubscriptionReactivatedEvent: ObjectSchema<models.SubscriptionReactivatedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.reactivated"),
    get metadata() {
      return SubscriptionReactivatedMetadata;
    },
  });
export const SubscriptionReactivatedMetadata: ObjectSchema<models.SubscriptionReactivatedMetadata> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    currency: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
  });
export const SubscriptionReinstatedEvent: ObjectSchema<models.SubscriptionReinstatedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.reinstated"),
    get metadata() {
      return SubscriptionReinstatedMetadata;
    },
  });
export const SubscriptionReinstatedMetadata: ObjectSchema<models.SubscriptionReinstatedMetadata> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    currency: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
  });
export const SubscriptionResume: ObjectSchema<models.SubscriptionResume> =
  /* @__PURE__ */ z.looseObject({ resume: /* @__PURE__ */ z.literal(true) });
export const SubscriptionResumedEvent: ObjectSchema<models.SubscriptionResumedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.resumed"),
    get metadata() {
      return SubscriptionResumedMetadata;
    },
  });
export const SubscriptionResumedMetadata: ObjectSchema<models.SubscriptionResumedMetadata> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    currency: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
  });
export const SubscriptionRevoke: ObjectSchema<models.SubscriptionRevoke> =
  /* @__PURE__ */ z.looseObject({
    customer_cancellation_reason: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(CustomerCancellationReason),
    ),
    customer_cancellation_comment: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    revoke: /* @__PURE__ */ z.literal(true),
  });
export const SubscriptionRevokedEvent: ObjectSchema<models.SubscriptionRevokedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.revoked"),
    get metadata() {
      return SubscriptionRevokedMetadata;
    },
  });
export const SubscriptionRevokedMetadata: ObjectSchema<models.SubscriptionRevokedMetadata> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    amount: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    currency: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    recurring_interval_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
  });
export const SubscriptionSeatsUpdatedEvent: ObjectSchema<models.SubscriptionSeatsUpdatedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.seats_updated"),
    get metadata() {
      return SubscriptionSeatsUpdatedMetadata;
    },
  });
export const SubscriptionSeatsUpdatedMetadata: ObjectSchema<models.SubscriptionSeatsUpdatedMetadata> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.string(),
    old_seats: /* @__PURE__ */ z.int(),
    new_seats: /* @__PURE__ */ z.int(),
    proration_behavior: /* @__PURE__ */ z.string(),
  });
export const SubscriptionUncanceledEvent: ObjectSchema<models.SubscriptionUncanceledEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.uncanceled"),
    get metadata() {
      return SubscriptionUncanceledMetadata;
    },
  });
export const SubscriptionUncanceledMetadata: ObjectSchema<models.SubscriptionUncanceledMetadata> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.string(),
    product_id: /* @__PURE__ */ z.string(),
    amount: /* @__PURE__ */ z.int(),
    currency: /* @__PURE__ */ z.string(),
    recurring_interval: /* @__PURE__ */ z.string(),
    recurring_interval_count: /* @__PURE__ */ z.int(),
  });
export const SubscriptionUnitsUpdatedEvent: ObjectSchema<models.SubscriptionUnitsUpdatedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.units_updated"),
    get metadata() {
      return SubscriptionUnitsUpdatedMetadata;
    },
  });
export const SubscriptionUnitsUpdatedMetadata: ObjectSchema<models.SubscriptionUnitsUpdatedMetadata> =
  /* @__PURE__ */ z.looseObject({
    subscription_id: /* @__PURE__ */ z.string(),
    old_units: /* @__PURE__ */ z.int(),
    new_units: /* @__PURE__ */ z.int(),
    proration_behavior: /* @__PURE__ */ z.string(),
  });
export const SubscriptionUpdateBase: ObjectSchema<models.SubscriptionUpdateBase> =
  /* @__PURE__ */ z.looseObject({
    metadata: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.record(
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.string(),
          /* @__PURE__ */ z.int(),
          /* @__PURE__ */ z.number(),
          /* @__PURE__ */ z.boolean(),
        ]),
      ),
    ),
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    proration_behavior: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(SubscriptionProrationBehavior),
    ),
    discount_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    trial_end: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.union([
        /* @__PURE__ */ z.string(),
        /* @__PURE__ */ z.literal("now"),
        /* @__PURE__ */ z.null(),
      ]),
    ),
  });
export const SubscriptionUpdateBillingPeriod: ObjectSchema<models.SubscriptionUpdateBillingPeriod> =
  /* @__PURE__ */ z.looseObject({ current_billing_period_end: /* @__PURE__ */ z.string() });
export const SubscriptionUpdateClear: ObjectSchema<models.SubscriptionUpdateClear> =
  /* @__PURE__ */ z.looseObject({ pending_update: /* @__PURE__ */ z.null() });
export const SubscriptionUpdateClearedEvent: ObjectSchema<models.SubscriptionUpdateClearedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.update_cleared"),
    get metadata() {
      return SubscriptionUpdateClearedMetadata;
    },
  });
export const SubscriptionUpdateClearedMetadata: ObjectSchema<models.SubscriptionUpdateClearedMetadata> =
  /* @__PURE__ */ z.looseObject({ subscription_id: /* @__PURE__ */ z.string() });
export const SubscriptionUpdateSeats: ObjectSchema<models.SubscriptionUpdateSeats> =
  /* @__PURE__ */ z.looseObject({
    seats: /* @__PURE__ */ z.int(),
    proration_behavior: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(SubscriptionProrationBehavior),
    ),
  });
export const SubscriptionUpdateUnits: ObjectSchema<models.SubscriptionUpdateUnits> =
  /* @__PURE__ */ z.looseObject({
    units: /* @__PURE__ */ z.int(),
    proration_behavior: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(SubscriptionProrationBehavior),
    ),
  });
export const SubscriptionUpdatedEvent: ObjectSchema<models.SubscriptionUpdatedEvent> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    timestamp: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get customer() {
      return /* @__PURE__ */ z.nullable(Customer);
    },
    external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    external_member_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    label: /* @__PURE__ */ z.string(),
    source: /* @__PURE__ */ z.literal("system"),
    name: /* @__PURE__ */ z.literal("subscription.updated"),
    get metadata() {
      return SubscriptionUpdatedMetadata;
    },
  });
export const SubscriptionUpdatedMetadata: ObjectSchema<models.SubscriptionUpdatedMetadata> =
  /* @__PURE__ */ z.looseObject({
    product_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    proration_behavior: /* @__PURE__ */ z.optional(SubscriptionProrationBehavior),
    discount_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    trial_end: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    seats: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    units: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
    billing_period_end: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.string()),
    subscription_id: /* @__PURE__ */ z.string(),
  });
export const SupportCaseAttachmentFileCreate: ObjectSchema<models.SupportCaseAttachmentFileCreate> =
  /* @__PURE__ */ z.looseObject({
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    name: /* @__PURE__ */ z.string(),
    mime_type: /* @__PURE__ */ z.string(),
    size: /* @__PURE__ */ z.int(),
    checksum_sha256_base64: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
    get upload() {
      return S3FileCreateMultipart;
    },
    service: /* @__PURE__ */ z.literal("support_case_attachment"),
    version: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const SupportCaseAttachmentFileRead: ObjectSchema<models.SupportCaseAttachmentFileRead> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    organization_id: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.string(),
    path: /* @__PURE__ */ z.string(),
    mime_type: /* @__PURE__ */ z.string(),
    size: /* @__PURE__ */ z.int(),
    storage_version: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checksum_etag: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checksum_sha256_base64: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    checksum_sha256_hex: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    last_modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    version: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    service: /* @__PURE__ */ z.literal("support_case_attachment"),
    is_uploaded: /* @__PURE__ */ z.boolean(),
    created_at: /* @__PURE__ */ z.string(),
    size_readable: /* @__PURE__ */ z.string(),
  });
export const Tier: ObjectSchema<models.Tier> = /* @__PURE__ */ z.looseObject({
  bound: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  unit_amount: /* @__PURE__ */ z.string(),
});
export const TierInput: ObjectSchema<models.TierInput> = /* @__PURE__ */ z.looseObject({
  bound: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  unit_amount: /* @__PURE__ */ z.union([/* @__PURE__ */ z.number(), /* @__PURE__ */ z.string()]),
});
export const Tiers: ObjectSchema<models.Tiers> = /* @__PURE__ */ z.looseObject({
  type: TierType,
  get tiers() {
    return /* @__PURE__ */ z.array(Tier);
  },
});
export const TiersInput: ObjectSchema<models.TiersInput> = /* @__PURE__ */ z.looseObject({
  type: TierType,
  get tiers() {
    return /* @__PURE__ */ z.array(TierInput);
  },
});
export const TokenResponse: ObjectSchema<models.TokenResponse> = /* @__PURE__ */ z.looseObject({
  access_token: /* @__PURE__ */ z.string(),
  token_type: /* @__PURE__ */ z.literal("Bearer"),
  expires_in: /* @__PURE__ */ z.int(),
  refresh_token: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  scope: /* @__PURE__ */ z.string(),
  id_token: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
});
export const TrialAlreadyRedeemed: ObjectSchema<models.TrialAlreadyRedeemed> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("TrialAlreadyRedeemed"),
    detail: /* @__PURE__ */ z.string(),
  });
export const Unauthorized: ObjectSchema<models.Unauthorized> = /* @__PURE__ */ z.looseObject({
  error: /* @__PURE__ */ z.literal("Unauthorized"),
  detail: /* @__PURE__ */ z.string(),
});
export const UniqueAggregation: ObjectSchema<models.UniqueAggregation> =
  /* @__PURE__ */ z.looseObject({
    func: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.literal("unique")),
    property: /* @__PURE__ */ z.string(),
  });
export const UpdateSubscriptionPlanNotAllowed: ObjectSchema<models.UpdateSubscriptionPlanNotAllowed> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("UpdateSubscriptionPlanNotAllowed"),
    detail: /* @__PURE__ */ z.string(),
  });
export const UpdateSubscriptionSeatsNotAllowed: ObjectSchema<models.UpdateSubscriptionSeatsNotAllowed> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("UpdateSubscriptionSeatsNotAllowed"),
    detail: /* @__PURE__ */ z.string(),
  });
export const UpdateSubscriptionUnitsNotAllowed: ObjectSchema<models.UpdateSubscriptionUnitsNotAllowed> =
  /* @__PURE__ */ z.looseObject({
    error: /* @__PURE__ */ z.literal("UpdateSubscriptionUnitsNotAllowed"),
    detail: /* @__PURE__ */ z.string(),
  });
export const UserEvent: ObjectSchema<models.UserEvent> = /* @__PURE__ */ z.looseObject({
  id: /* @__PURE__ */ z.string(),
  timestamp: /* @__PURE__ */ z.string(),
  organization_id: /* @__PURE__ */ z.string(),
  customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get customer() {
    return /* @__PURE__ */ z.nullable(Customer);
  },
  external_customer_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  member_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  external_member_id: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  ),
  child_count: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.int()),
  parent_id: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  label: /* @__PURE__ */ z.string(),
  name: /* @__PURE__ */ z.string(),
  source: /* @__PURE__ */ z.literal("user"),
  get metadata() {
    return EventMetadataOutput;
  },
});
export const UserInfoOrganization: ObjectSchema<models.UserInfoOrganization> =
  /* @__PURE__ */ z.looseObject({
    sub: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  });
export const UserInfoUser: ObjectSchema<models.UserInfoUser> = /* @__PURE__ */ z.looseObject({
  sub: /* @__PURE__ */ z.string(),
  name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  email: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  email_verified: /* @__PURE__ */ z.optional(
    /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean()),
  ),
});
export const ValidatedLicenseKey: ObjectSchema<models.ValidatedLicenseKey> =
  /* @__PURE__ */ z.looseObject({
    id: /* @__PURE__ */ z.string(),
    created_at: /* @__PURE__ */ z.string(),
    modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    organization_id: /* @__PURE__ */ z.string(),
    customer_id: /* @__PURE__ */ z.string(),
    get customer() {
      return LicenseKeyCustomer;
    },
    member_id: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get member() {
      return /* @__PURE__ */ z.nullable(LicenseKeyMember);
    },
    benefit_id: /* @__PURE__ */ z.string(),
    key: /* @__PURE__ */ z.string(),
    display_key: /* @__PURE__ */ z.string(),
    status: /* @__PURE__ */ z.literal("granted"),
    limit_activations: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    usage: /* @__PURE__ */ z.int(),
    limit_usage: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
    validations: /* @__PURE__ */ z.int(),
    last_validated_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    expires_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    get activation() {
      return /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(LicenseKeyActivationBase));
    },
  });
export const ValidationError: ObjectSchema<models.ValidationError> = /* @__PURE__ */ z.looseObject({
  loc: /* @__PURE__ */ z.array(
    /* @__PURE__ */ z.union([/* @__PURE__ */ z.string(), /* @__PURE__ */ z.int()]),
  ),
  msg: /* @__PURE__ */ z.string(),
  type: /* @__PURE__ */ z.string(),
  input: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.unknown()),
  get ctx() {
    return /* @__PURE__ */ z.optional(Context);
  },
});
export const WebhookDelivery: ObjectSchema<models.WebhookDelivery> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  succeeded: /* @__PURE__ */ z.boolean(),
  http_code: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int()),
  response: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  get webhook_event() {
    return WebhookEvent;
  },
});
export const WebhookEndpoint: ObjectSchema<models.WebhookEndpoint> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  url: /* @__PURE__ */ z.string(),
  name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
  api_version: /* @__PURE__ */ z.string(),
  format: WebhookFormat,
  secret: /* @__PURE__ */ z.string(),
  organization_id: /* @__PURE__ */ z.string(),
  events: /* @__PURE__ */ z.array(WebhookEventType),
  enabled: /* @__PURE__ */ z.boolean(),
  uses_standard_webhook_signature: /* @__PURE__ */ z.boolean(),
});
export const WebhookEndpointCreate: ObjectSchema<models.WebhookEndpointCreate> =
  /* @__PURE__ */ z.looseObject({
    url: /* @__PURE__ */ z.string(),
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    api_version: /* @__PURE__ */ z.optional(ApiVersion),
    format: WebhookFormat,
    events: /* @__PURE__ */ z.array(WebhookEventType),
    organization_id: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
    ),
  });
export const WebhookEndpointUpdate: ObjectSchema<models.WebhookEndpointUpdate> =
  /* @__PURE__ */ z.looseObject({
    url: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    name: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string())),
    api_version: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(
        /* @__PURE__ */ z.union([
          /* @__PURE__ */ z.literal("2026-04"),
          /* @__PURE__ */ z.literal("2026-10"),
        ]),
      ),
    ),
    format: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(WebhookFormat)),
    events: /* @__PURE__ */ z.optional(
      /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.array(WebhookEventType)),
    ),
    enabled: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean())),
  });
export const WebhookEvent: ObjectSchema<models.WebhookEvent> = /* @__PURE__ */ z.looseObject({
  created_at: /* @__PURE__ */ z.string(),
  modified_at: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  id: /* @__PURE__ */ z.string(),
  last_http_code: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.int())),
  succeeded: /* @__PURE__ */ z.optional(/* @__PURE__ */ z.nullable(/* @__PURE__ */ z.boolean())),
  skipped: /* @__PURE__ */ z.boolean(),
  api_version: /* @__PURE__ */ z.string(),
  payload: /* @__PURE__ */ z.nullable(/* @__PURE__ */ z.string()),
  type: WebhookEventType,
  is_archived: /* @__PURE__ */ z.boolean(),
});
export const Benefit: ObjectSchema<models.Benefit> = /* @__PURE__ */ z.discriminatedUnion("type", [
  BenefitCustom,
  BenefitDiscord,
  BenefitGitHubRepository,
  BenefitDownloadables,
  BenefitLicenseKeys,
  BenefitMeterCredit,
  BenefitFeatureFlag,
  BenefitSlackSharedChannel,
]);
export const BenefitCreate: ObjectSchema<models.BenefitCreate> =
  /* @__PURE__ */ z.discriminatedUnion("type", [
    BenefitCustomCreate,
    BenefitDiscordCreate,
    BenefitGitHubRepositoryCreate,
    BenefitDownloadablesCreate,
    BenefitLicenseKeysCreate,
    BenefitMeterCreditCreate,
    BenefitFeatureFlagCreate,
    BenefitSlackSharedChannelCreate,
  ]);
export const BenefitGrantWebhook: Schema<models.BenefitGrantWebhook> = /* @__PURE__ */ z.union([
  BenefitGrantDiscordWebhook,
  BenefitGrantCustomWebhook,
  BenefitGrantGitHubRepositoryWebhook,
  BenefitGrantDownloadablesWebhook,
  BenefitGrantLicenseKeysWebhook,
  BenefitGrantMeterCreditWebhook,
  BenefitGrantFeatureFlagWebhook,
  BenefitGrantSlackSharedChannelWebhook,
]);
export const BenefitPublic: ObjectSchema<models.BenefitPublic> =
  /* @__PURE__ */ z.discriminatedUnion("type", [
    BenefitCustomPublic,
    BenefitDiscordPublic,
    BenefitGitHubRepositoryPublic,
    BenefitDownloadablesPublic,
    BenefitLicenseKeysPublic,
    BenefitFeatureFlagPublic,
    BenefitSlackSharedChannelPublic,
    BenefitMeterCreditPublic,
  ]);
export const CheckoutForbiddenError: Schema<models.CheckoutForbiddenError> =
  /* @__PURE__ */ z.union([
    AlreadyActiveSubscriptionError,
    NotOpenCheckout,
    NotPermitted,
    PaymentNotReady,
    TrialAlreadyRedeemed,
    DiscountRedemptionLimitReached,
  ]);
export const CheckoutLinkCreate: Schema<models.CheckoutLinkCreate> = /* @__PURE__ */ z.union([
  CheckoutLinkCreateProductPrice,
  CheckoutLinkCreateProduct,
  CheckoutLinkCreateProducts,
]);
export const CustomField: ObjectSchema<models.CustomField> = /* @__PURE__ */ z.discriminatedUnion(
  "type",
  [CustomFieldText, CustomFieldNumber, CustomFieldDate, CustomFieldCheckbox, CustomFieldSelect],
);
export const CustomFieldCreate: ObjectSchema<models.CustomFieldCreate> =
  /* @__PURE__ */ z.discriminatedUnion("type", [
    CustomFieldCreateText,
    CustomFieldCreateNumber,
    CustomFieldCreateDate,
    CustomFieldCreateCheckbox,
    CustomFieldCreateSelect,
  ]);
export const CustomFieldUpdate: ObjectSchema<models.CustomFieldUpdate> =
  /* @__PURE__ */ z.discriminatedUnion("type", [
    CustomFieldUpdateText,
    CustomFieldUpdateNumber,
    CustomFieldUpdateDate,
    CustomFieldUpdateCheckbox,
    CustomFieldUpdateSelect,
  ]);
export const Customer: ObjectSchema<models.Customer> = /* @__PURE__ */ z.discriminatedUnion(
  "type",
  [CustomerIndividual, CustomerTeam],
);
export const CustomerBenefitGrant: Schema<models.CustomerBenefitGrant> = /* @__PURE__ */ z.union([
  CustomerBenefitGrantDiscord,
  CustomerBenefitGrantGitHubRepository,
  CustomerBenefitGrantDownloadables,
  CustomerBenefitGrantLicenseKeys,
  CustomerBenefitGrantCustom,
  CustomerBenefitGrantMeterCredit,
  CustomerBenefitGrantFeatureFlag,
  CustomerBenefitGrantSlackSharedChannel,
]);
export const CustomerBenefitGrantUpdate: ObjectSchema<models.CustomerBenefitGrantUpdate> =
  /* @__PURE__ */ z.discriminatedUnion("benefit_type", [
    CustomerBenefitGrantDiscordUpdate,
    CustomerBenefitGrantGitHubRepositoryUpdate,
    CustomerBenefitGrantDownloadablesUpdate,
    CustomerBenefitGrantLicenseKeysUpdate,
    CustomerBenefitGrantCustomUpdate,
    CustomerBenefitGrantMeterCreditUpdate,
    CustomerBenefitGrantFeatureFlagUpdate,
    CustomerBenefitGrantSlackSharedChannelUpdate,
  ]);
export const CustomerCreate: Schema<models.CustomerCreate> = /* @__PURE__ */ z.union([
  CustomerIndividualCreate,
  CustomerTeamCreate,
]);
export const CustomerPaymentMethod: Schema<models.CustomerPaymentMethod> = /* @__PURE__ */ z.union([
  PaymentMethodCard,
  PaymentMethodKrCard,
  PaymentMethodGeneric,
]);
export const CustomerPaymentMethodCreateResponse: ObjectSchema<models.CustomerPaymentMethodCreateResponse> =
  /* @__PURE__ */ z.discriminatedUnion("status", [
    CustomerPaymentMethodCreateSucceededResponse,
    CustomerPaymentMethodCreateRequiresActionResponse,
  ]);
export const CustomerState: ObjectSchema<models.CustomerState> =
  /* @__PURE__ */ z.discriminatedUnion("type", [CustomerStateIndividual, CustomerStateTeam]);
export const CustomerSubscriptionUpdate: Schema<models.CustomerSubscriptionUpdate> =
  /* @__PURE__ */ z.union([
    CustomerSubscriptionUpdateProduct,
    CustomerSubscriptionUpdateSeats,
    CustomerSubscriptionUpdateUnits,
    CustomerSubscriptionCancel,
    CustomerSubscriptionPause,
    CustomerSubscriptionResume,
    CustomerSubscriptionUpdateClear,
  ]);
export const Discount: Schema<models.Discount> = /* @__PURE__ */ z.union([
  DiscountFixedOnceForeverDuration,
  DiscountFixedRepeatDuration,
  DiscountPercentageOnceForeverDuration,
  DiscountPercentageRepeatDuration,
]);
export const DiscountCreate: Schema<models.DiscountCreate> = /* @__PURE__ */ z.union([
  DiscountFixedCreate,
  DiscountPercentageCreate,
]);
export const SystemEvent: ObjectSchema<models.SystemEvent> = /* @__PURE__ */ z.discriminatedUnion(
  "name",
  [
    MeterCreditEvent,
    MeterResetEvent,
    BenefitGrantedEvent,
    BenefitCycledEvent,
    BenefitUpdatedEvent,
    BenefitRevokedEvent,
    SubscriptionCreatedEvent,
    SubscriptionUpdatedEvent,
    SubscriptionCycledEvent,
    SubscriptionCanceledEvent,
    SubscriptionRevokedEvent,
    SubscriptionPastDueEvent,
    SubscriptionReactivatedEvent,
    SubscriptionReinstatedEvent,
    SubscriptionPausedEvent,
    SubscriptionResumedEvent,
    SubscriptionMigratedEvent,
    SubscriptionUncanceledEvent,
    SubscriptionProductUpdatedEvent,
    SubscriptionSeatsUpdatedEvent,
    SubscriptionUnitsUpdatedEvent,
    SubscriptionBillingPeriodUpdatedEvent,
    SubscriptionUpdateClearedEvent,
    OrderPaidEvent,
    OrderRefundedEvent,
    OrderVoidedEvent,
    OrderUnvoidedEvent,
    CheckoutCreatedEvent,
    CustomerCreatedEvent,
    CustomerUpdatedEvent,
    CustomerDeletedEvent,
    BalanceOrderEvent,
    BalanceCreditOrderEvent,
    BalanceRefundEvent,
    BalanceRefundReversalEvent,
    BalanceDisputeEvent,
    BalanceDisputeReversalEvent,
  ],
);
export const FileCreate: ObjectSchema<models.FileCreate> = /* @__PURE__ */ z.discriminatedUnion(
  "service",
  [
    DownloadableFileCreate,
    ProductMediaFileCreate,
    OrganizationAvatarFileCreate,
    SupportCaseAttachmentFileCreate,
  ],
);
export const FileRead: ObjectSchema<models.FileRead> = /* @__PURE__ */ z.discriminatedUnion(
  "service",
  [
    DownloadableFileRead,
    ProductMediaFileRead,
    OrganizationAvatarFileRead,
    SupportCaseAttachmentFileRead,
  ],
);
export const LegacyRecurringProductPrice: ObjectSchema<models.LegacyRecurringProductPrice> =
  /* @__PURE__ */ z.discriminatedUnion("amount_type", [
    LegacyRecurringProductPriceFixed,
    LegacyRecurringProductPriceCustom,
  ]);
export const MetadataQuery: Schema<models.MetadataQuery> = /* @__PURE__ */ z.union([
  /* @__PURE__ */ z.record(
    /* @__PURE__ */ z.string(),
    /* @__PURE__ */ z.union([
      /* @__PURE__ */ z.string(),
      /* @__PURE__ */ z.int(),
      /* @__PURE__ */ z.boolean(),
      /* @__PURE__ */ z.array(/* @__PURE__ */ z.string()),
      /* @__PURE__ */ z.array(/* @__PURE__ */ z.int()),
      /* @__PURE__ */ z.array(/* @__PURE__ */ z.boolean()),
    ]),
  ),
  /* @__PURE__ */ z.null(),
]);
export const Payment: Schema<models.Payment> = /* @__PURE__ */ z.union([
  CardPayment,
  KrCardPayment,
  GenericPayment,
]);
export const PaymentMethod: Schema<models.PaymentMethod> = /* @__PURE__ */ z.union([
  CustomerPaymentMethodCard,
  CustomerPaymentMethodKrCard,
  CustomerPaymentMethodGeneric,
]);
export const ProductCreate: Schema<models.ProductCreate> = /* @__PURE__ */ z.union([
  ProductCreateRecurring,
  ProductCreateOneTime,
]);
export const ProductPrice: ObjectSchema<models.ProductPrice> = /* @__PURE__ */ z.discriminatedUnion(
  "amount_type",
  [
    ProductPriceFixed,
    ProductPriceCustom,
    ProductPriceSeatBased,
    ProductPriceUnitBased,
    ProductPriceMeteredUnit,
    ProductPriceMeteredTiers,
  ],
);
export const SubscriptionUpdate: Schema<models.SubscriptionUpdate> = /* @__PURE__ */ z.union([
  SubscriptionUpdateBase,
  SubscriptionUpdateSeats,
  SubscriptionUpdateUnits,
  SubscriptionUpdateBillingPeriod,
  SubscriptionCancel,
  SubscriptionRevoke,
  SubscriptionPause,
  SubscriptionResume,
  SubscriptionUpdateClear,
]);
export const Event: ObjectSchema<models.Event> = /* @__PURE__ */ z.discriminatedUnion("source", [
  SystemEvent,
  UserEvent,
]);
export const WebhookBenefitCreatedPayload: ObjectSchema<webhooks.WebhookBenefitCreatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("benefit.created"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Benefit;
    },
  });
export const WebhookBenefitGrantCreatedPayload: ObjectSchema<webhooks.WebhookBenefitGrantCreatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("benefit_grant.created"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return BenefitGrantWebhook;
    },
  });
export const WebhookBenefitGrantCycledPayload: ObjectSchema<webhooks.WebhookBenefitGrantCycledPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("benefit_grant.cycled"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return BenefitGrantWebhook;
    },
  });
export const WebhookBenefitGrantRevokedPayload: ObjectSchema<webhooks.WebhookBenefitGrantRevokedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("benefit_grant.revoked"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return BenefitGrantWebhook;
    },
  });
export const WebhookBenefitGrantUpdatedPayload: ObjectSchema<webhooks.WebhookBenefitGrantUpdatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("benefit_grant.updated"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return BenefitGrantWebhook;
    },
  });
export const WebhookBenefitUpdatedPayload: ObjectSchema<webhooks.WebhookBenefitUpdatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("benefit.updated"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Benefit;
    },
  });
export const WebhookCheckoutCreatedPayload: ObjectSchema<webhooks.WebhookCheckoutCreatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("checkout.created"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Checkout;
    },
  });
export const WebhookCheckoutExpiredPayload: ObjectSchema<webhooks.WebhookCheckoutExpiredPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("checkout.expired"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Checkout;
    },
  });
export const WebhookCheckoutUpdatedPayload: ObjectSchema<webhooks.WebhookCheckoutUpdatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("checkout.updated"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Checkout;
    },
  });
export const WebhookCustomerCreatedPayload: ObjectSchema<webhooks.WebhookCustomerCreatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("customer.created"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Customer;
    },
  });
export const WebhookCustomerDeletedPayload: ObjectSchema<webhooks.WebhookCustomerDeletedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("customer.deleted"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Customer;
    },
  });
export const WebhookCustomerSeatAssignedPayload: ObjectSchema<webhooks.WebhookCustomerSeatAssignedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("customer_seat.assigned"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return CustomerSeat;
    },
  });
export const WebhookCustomerSeatClaimedPayload: ObjectSchema<webhooks.WebhookCustomerSeatClaimedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("customer_seat.claimed"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return CustomerSeat;
    },
  });
export const WebhookCustomerSeatRevokedPayload: ObjectSchema<webhooks.WebhookCustomerSeatRevokedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("customer_seat.revoked"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return CustomerSeat;
    },
  });
export const WebhookCustomerStateChangedPayload: ObjectSchema<webhooks.WebhookCustomerStateChangedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("customer.state_changed"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return CustomerState;
    },
  });
export const WebhookCustomerUpdatedPayload: ObjectSchema<webhooks.WebhookCustomerUpdatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("customer.updated"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Customer;
    },
  });
export const WebhookDiscountCreatedPayload: ObjectSchema<webhooks.WebhookDiscountCreatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("discount.created"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Discount;
    },
  });
export const WebhookDiscountDeletedPayload: ObjectSchema<webhooks.WebhookDiscountDeletedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("discount.deleted"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Discount;
    },
  });
export const WebhookDiscountUpdatedPayload: ObjectSchema<webhooks.WebhookDiscountUpdatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("discount.updated"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Discount;
    },
  });
export const WebhookMemberCreatedPayload: ObjectSchema<webhooks.WebhookMemberCreatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("member.created"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Member;
    },
  });
export const WebhookMemberDeletedPayload: ObjectSchema<webhooks.WebhookMemberDeletedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("member.deleted"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Member;
    },
  });
export const WebhookMemberUpdatedPayload: ObjectSchema<webhooks.WebhookMemberUpdatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("member.updated"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Member;
    },
  });
export const WebhookOrderCreatedPayload: ObjectSchema<webhooks.WebhookOrderCreatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("order.created"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Order;
    },
  });
export const WebhookOrderPaidPayload: ObjectSchema<webhooks.WebhookOrderPaidPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("order.paid"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Order;
    },
  });
export const WebhookOrderRefundedPayload: ObjectSchema<webhooks.WebhookOrderRefundedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("order.refunded"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Order;
    },
  });
export const WebhookOrderUpdatedPayload: ObjectSchema<webhooks.WebhookOrderUpdatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("order.updated"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Order;
    },
  });
export const WebhookOrganizationUpdatedPayload: ObjectSchema<webhooks.WebhookOrganizationUpdatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("organization.updated"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Organization;
    },
  });
export const WebhookProductCreatedPayload: ObjectSchema<webhooks.WebhookProductCreatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("product.created"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Product;
    },
  });
export const WebhookProductUpdatedPayload: ObjectSchema<webhooks.WebhookProductUpdatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("product.updated"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Product;
    },
  });
export const WebhookRefundCreatedPayload: ObjectSchema<webhooks.WebhookRefundCreatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("refund.created"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Refund;
    },
  });
export const WebhookRefundUpdatedPayload: ObjectSchema<webhooks.WebhookRefundUpdatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("refund.updated"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Refund;
    },
  });
export const WebhookSubscriptionActivePayload: ObjectSchema<webhooks.WebhookSubscriptionActivePayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("subscription.active"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Subscription;
    },
  });
export const WebhookSubscriptionCanceledPayload: ObjectSchema<webhooks.WebhookSubscriptionCanceledPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("subscription.canceled"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Subscription;
    },
  });
export const WebhookSubscriptionCreatedPayload: ObjectSchema<webhooks.WebhookSubscriptionCreatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("subscription.created"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Subscription;
    },
  });
export const WebhookSubscriptionCycledPayload: ObjectSchema<webhooks.WebhookSubscriptionCycledPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("subscription.cycled"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Subscription;
    },
  });
export const WebhookSubscriptionMigratedPayload: ObjectSchema<webhooks.WebhookSubscriptionMigratedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("subscription.migrated"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Subscription;
    },
    provider: /* @__PURE__ */ z.string(),
    provider_subscription_id: /* @__PURE__ */ z.string(),
  });
export const WebhookSubscriptionPastDuePayload: ObjectSchema<webhooks.WebhookSubscriptionPastDuePayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("subscription.past_due"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Subscription;
    },
  });
export const WebhookSubscriptionPausedPayload: ObjectSchema<webhooks.WebhookSubscriptionPausedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("subscription.paused"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Subscription;
    },
  });
export const WebhookSubscriptionResumedPayload: ObjectSchema<webhooks.WebhookSubscriptionResumedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("subscription.resumed"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Subscription;
    },
  });
export const WebhookSubscriptionRevokedPayload: ObjectSchema<webhooks.WebhookSubscriptionRevokedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("subscription.revoked"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Subscription;
    },
  });
export const WebhookSubscriptionUncanceledPayload: ObjectSchema<webhooks.WebhookSubscriptionUncanceledPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("subscription.uncanceled"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Subscription;
    },
  });
export const WebhookSubscriptionUpdatedPayload: ObjectSchema<webhooks.WebhookSubscriptionUpdatedPayload> =
  /* @__PURE__ */ z.looseObject({
    type: /* @__PURE__ */ z.literal("subscription.updated"),
    timestamp: /* @__PURE__ */ z.string(),
    api_version: /* @__PURE__ */ z.string(),
    get data() {
      return Subscription;
    },
  });
export const WebhookPayload: Schema<webhooks.WebhookPayload> = /* @__PURE__ */ z.discriminatedUnion(
  "type",
  [
    WebhookBenefitCreatedPayload,
    WebhookBenefitGrantCreatedPayload,
    WebhookBenefitGrantCycledPayload,
    WebhookBenefitGrantRevokedPayload,
    WebhookBenefitGrantUpdatedPayload,
    WebhookBenefitUpdatedPayload,
    WebhookCheckoutCreatedPayload,
    WebhookCheckoutExpiredPayload,
    WebhookCheckoutUpdatedPayload,
    WebhookCustomerCreatedPayload,
    WebhookCustomerDeletedPayload,
    WebhookCustomerSeatAssignedPayload,
    WebhookCustomerSeatClaimedPayload,
    WebhookCustomerSeatRevokedPayload,
    WebhookCustomerStateChangedPayload,
    WebhookCustomerUpdatedPayload,
    WebhookDiscountCreatedPayload,
    WebhookDiscountDeletedPayload,
    WebhookDiscountUpdatedPayload,
    WebhookMemberCreatedPayload,
    WebhookMemberDeletedPayload,
    WebhookMemberUpdatedPayload,
    WebhookOrderCreatedPayload,
    WebhookOrderPaidPayload,
    WebhookOrderRefundedPayload,
    WebhookOrderUpdatedPayload,
    WebhookOrganizationUpdatedPayload,
    WebhookProductCreatedPayload,
    WebhookProductUpdatedPayload,
    WebhookRefundCreatedPayload,
    WebhookRefundUpdatedPayload,
    WebhookSubscriptionActivePayload,
    WebhookSubscriptionCanceledPayload,
    WebhookSubscriptionCreatedPayload,
    WebhookSubscriptionCycledPayload,
    WebhookSubscriptionMigratedPayload,
    WebhookSubscriptionPastDuePayload,
    WebhookSubscriptionPausedPayload,
    WebhookSubscriptionResumedPayload,
    WebhookSubscriptionRevokedPayload,
    WebhookSubscriptionUncanceledPayload,
    WebhookSubscriptionUpdatedPayload,
  ],
);
