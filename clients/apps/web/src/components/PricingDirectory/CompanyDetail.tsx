import Link from 'next/link'
import React from 'react'
import { BrandContainer, Caption, Display, Lead } from '../Brand/primitives'
import { companyModels, productSlug } from './data'
import { ChangeDirection, Company } from './types'

const directionLabel: Record<ChangeDirection, string> = {
  up: 'Increase',
  down: 'Decrease',
  new: 'New',
}

export function CompanyDetail({ company }: { company: Company }) {
  const dates = company.products
    .flatMap((product) => product.history.map((point) => point.date))
    .sort()
  const since = dates[0]?.slice(0, 4)

  const facts = [
    { value: `${company.products.length}`, label: 'Products' },
    { value: companyModels(company).join(' · '), label: 'Models' },
    { value: since ?? '', label: 'Tracking since' },
  ]

  return (
    <>
      <section className="bg-brand-raised pt-20 pb-16 md:pt-32 md:pb-24">
        <BrandContainer className="flex flex-col gap-12 md:gap-16">
          <Caption>{company.category}</Caption>
          <Display className="max-w-[16ch]">{company.name}</Display>
          <Lead className="max-w-2xl">{company.summary}</Lead>
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
          <div className="text-brand-muted flex items-center gap-x-3 text-2xl">
            <span>001</span>
            <span className="bg-brand-muted h-px w-12" />
            <span>Products</span>
          </div>

          <div className="flex flex-col gap-10 md:gap-12">
            {company.products.map((product) => (
              <div key={product.name} className="flex flex-col gap-3">
                <Link
                  href={`/pricing-directory/${company.slug}/${productSlug(product.name)}`}
                  className="group border-brand-line flex items-baseline gap-3 border-b pb-3"
                >
                  <span className="text-brand-foreground group-hover:text-brand-muted text-xl transition-colors md:text-2xl">
                    {product.name}
                  </span>
                  <span className="text-brand-muted text-base md:text-2xl">
                    {product.model}
                  </span>
                </Link>

                <div className="flex flex-col">
                  {product.history.map((point) => (
                    <div
                      key={point.date}
                      className="border-brand-line grid grid-cols-12 items-baseline gap-4 border-t py-2 text-base first:border-t-0 md:text-lg"
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
              </div>
            ))}
          </div>
        </BrandContainer>
      </section>
    </>
  )
}
