import { Schema, Struct } from "effect";

export const CreateProductPriceCustom = Schema.Struct({
	amountType: Schema.Literal("custom"),
	priceCurrency: Schema.Literal("USD").transform("usd"),
	minimumAmount: Schema.optional(Schema.Number),
	maximumAmount: Schema.optional(Schema.Number),
	presetAmount: Schema.optional(Schema.Number),
}).mapFields(Struct.map(Schema.mutableKey));

export const CreateProductPriceFree = Schema.Struct({
	amountType: Schema.Literal("free"),
}).mapFields(Struct.map(Schema.mutableKey));

export const CreateProductPriceFixed = Schema.Struct({
	amountType: Schema.Literal("fixed"),
	priceCurrency: Schema.Literal("usd"),
	priceAmount: Schema.Number,
}).mapFields(Struct.map(Schema.mutableKey));

export const ProductCreate = Schema.Struct({
	name: Schema.String,
	description: Schema.String,
	recurringInterval: Schema.NullOr(Schema.Literals(["month", "year"])),
	prices: Schema.mutable(
		Schema.Tuple([
			Schema.Union([
				CreateProductPriceCustom,
				CreateProductPriceFree,
				CreateProductPriceFixed,
			]),
		]),
	),
}).mapFields(Struct.map(Schema.mutableKey));

export type ProductCreate = typeof ProductCreate.Type;
