import Link from 'next/link'
import React from 'react'
import { BrandContainer, Caption, Display, Lead } from '../Brand/primitives'
import { ChangeDirection, Company, Product, ProductFeature } from './types'

const directionLabel: Record<ChangeDirection, string> = {
  up: 'Increase',
  down: 'Decrease',
  new: 'New',
}

const humanize = (value: string): string =>
  value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

function groupFeatures(
  features: ProductFeature[],
): { category: string; items: ProductFeature[] }[] {
  const groups = new Map<string, ProductFeature[]>()
  for (const feature of features) {
    const items = groups.get(feature.category) ?? []
    items.push(feature)
    groups.set(feature.category, items)
  }
  return Array.from(groups.entries())
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => a.category.localeCompare(b.category))
}

function SectionHeader({ index, label }: { index: string; label: string }) {
  return (
    <div className="text-brand-muted flex items-center gap-x-3 text-2xl">
      <span>{index}</span>
      <span className="bg-brand-muted h-px w-12" />
      <span>{label}</span>
    </div>
  )
}

export function ProductDetail({
  company,
  product,
}: {
  company: Company
  product: Product
}) {
  const dates = product.history.map((point) => point.date).sort()
  const since = dates[0]?.slice(0, 4)
  const features = groupFeatures(product.features)

  const facts = [
    { value: product.model, label: 'Model' },
    { value: product.anchor, label: 'Entry price' },
    { value: since ?? '', label: 'Tracking since' },
  ]

  return (
    <>
      <section className="bg-brand-raised pt-20 pb-16 md:pt-32 md:pb-24">
        <BrandContainer className="flex flex-col gap-12 md:gap-16">
          <Link
            href={`/pricing-directory/${company.slug}`}
            className="text-brand-muted hover:text-brand-foreground text-xl transition-colors"
          >
            {company.name}
          </Link>
          <Display className="max-w-[16ch]">{product.name}</Display>
          <Lead className="max-w-2xl">
            {product.model} pricing, currently from {product.anchor}.
          </Lead>
          <div className="border-brand-muted grid grid-cols-2 gap-x-8 gap-y-10 border-t pt-12 md:grid-cols-3 md:pt-16">
            {facts.map((fact) => (
              <div key={fact.label} className="flex flex-col gap-3">
                <span className="text-brand-foreground text-2xl tracking-tight md:text-4xl">
                  {fact.value}
                </span>
                <Caption>{fact.label}</Caption>
              </div>
            ))}
          </div>
        </BrandContainer>
      </section>

      <section className="py-24 md:py-40">
        <BrandContainer className="flex flex-col gap-16 md:gap-24">
          <SectionHeader index="001" label="Price history" />
          <div className="flex flex-col">
            {product.history.map((point) => (
              <div
                key={point.date}
                className="border-brand-line grid grid-cols-12 items-baseline gap-4 border-t py-3 text-base first:border-t-0 md:text-lg"
              >
                <span className="text-brand-muted col-span-3 tabular-nums">
                  {point.date}
                </span>
                <span className="text-brand-foreground col-span-6 tabular-nums">
                  {point.value}
                </span>
                <span className="text-brand-muted col-span-3 text-right">
                  {directionLabel[point.direction]}
                </span>
              </div>
            ))}
          </div>
        </BrandContainer>
      </section>

      {product.metrics.length > 0 ? (
        <section className="pb-24 md:pb-40">
          <BrandContainer className="flex flex-col gap-16 md:gap-24">
            <SectionHeader index="002" label="Metrics" />
            <div className="flex flex-col">
              {product.metrics.map((metric) => (
                <div
                  key={`${metric.label}-${metric.unit}`}
                  className="border-brand-line grid grid-cols-12 items-baseline gap-4 border-t py-3 text-base first:border-t-0 md:text-lg"
                >
                  <span className="text-brand-foreground col-span-6">
                    {metric.label}
                  </span>
                  <span className="text-brand-muted col-span-3">
                    {metric.unit}
                  </span>
                  <span className="text-brand-foreground col-span-3 text-right tabular-nums">
                    {metric.currency}
                    {metric.amount}
                    {metric.perQuantity > 1 ? ` / ${metric.perQuantity}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </BrandContainer>
        </section>
      ) : null}

      {features.length > 0 ? (
        <section className="pb-24 md:pb-40">
          <BrandContainer className="flex flex-col gap-16 md:gap-24">
            <SectionHeader index="003" label="Features" />
            <div className="flex flex-col gap-12 md:gap-16">
              {features.map((group) => (
                <div key={group.category} className="flex flex-col gap-4">
                  <Caption className="text-brand-foreground">
                    {humanize(group.category)}
                  </Caption>
                  <div className="flex flex-col">
                    {group.items.map((feature) => (
                      <div
                        key={feature.key}
                        className="border-brand-line grid grid-cols-12 items-baseline gap-4 border-t py-3 text-base first:border-t-0 md:text-lg"
                      >
                        <span className="text-brand-foreground col-span-8">
                          {feature.name}
                        </span>
                        <span className="text-brand-muted col-span-4 text-right">
                          {feature.value ?? 'Included'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </BrandContainer>
        </section>
      ) : null}
    </>
  )
}
