import Link from 'next/link'
import React from 'react'
import { BrandContainer, Body, Caption, Heading, Lead } from '../Brand/primitives'
import { articles } from './editorial'

export function EditorialSection() {
  return (
    <section id="reading" className="scroll-mt-24 py-24 md:py-40">
      <BrandContainer className="flex flex-col gap-16 md:gap-24">
        <div className="flex flex-col gap-10 md:gap-14">
          <div className="text-brand-muted flex items-center gap-x-3 text-2xl">
            <span>003</span>
            <span className="bg-brand-muted h-px w-12" />
            <span>Reading</span>
          </div>
          <Heading className="max-w-5xl">On pricing</Heading>
          <Lead>
            Essays, teardowns, and field notes on how to price, drawn from the
            directory.
          </Lead>
        </div>

        <div className="flex flex-col">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/pricing-directory/editorial/${article.slug}`}
              className="group border-brand-line grid grid-cols-1 gap-6 border-t py-10 first:border-t-0 first:pt-0 md:grid-cols-12 md:items-center md:gap-8 md:py-12"
            >
              <div className="bg-brand-raised flex aspect-video items-center justify-center overflow-hidden md:col-span-4">
                <Caption>Image</Caption>
              </div>
              <div className="flex flex-col gap-4 md:col-span-8">
                <div className="flex gap-x-6">
                  <Caption>{article.category}</Caption>
                  <Caption className="tabular-nums">
                    {article.readingTime}
                  </Caption>
                </div>
                <h3 className="text-brand-foreground group-hover:text-brand-muted text-3xl tracking-tight transition-colors md:text-5xl">
                  {article.title}
                </h3>
                <Body className="max-w-2xl">{article.dek}</Body>
              </div>
            </Link>
          ))}
        </div>
      </BrandContainer>
    </section>
  )
}
