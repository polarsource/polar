'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  BrandContainer,
  Body,
  Caption,
  Heading,
  Lead,
} from '../Brand/primitives'
import { Article, ChartBar } from './editorial'

function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null)

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible.length > 0) setActive(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: [0, 1] },
    )
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [ids])

  return active
}

function Chart({ bars }: { bars: ChartBar[] }) {
  return (
    <div className="flex flex-col gap-6">
      {bars.map((bar) => (
        <div key={bar.label} className="flex flex-col gap-2">
          <div className="flex items-baseline gap-3">
            <span className="text-brand-foreground text-lg">{bar.label}</span>
            {bar.delta ? (
              <Caption className="text-base">{bar.delta}</Caption>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-brand-line relative h-3 flex-1 overflow-hidden">
              <div
                className="bg-brand-foreground absolute inset-y-0 left-0"
                style={{ width: `${bar.value}%` }}
              />
            </div>
            <span className="text-brand-foreground w-12 text-right text-lg tabular-nums">
              {bar.value}%
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ArticleDetail({ article }: { article: Article }) {
  const sectionIds = useMemo(
    () => article.sections.map((section) => section.id),
    [article],
  )
  const active = useActiveSection(sectionIds)

  return (
    <>
      <section className="bg-brand-raised pt-20 pb-16 md:pt-32 md:pb-24">
        <BrandContainer className="flex max-w-3xl flex-col gap-10">
          <Caption>{article.category}</Caption>
          <Heading>{article.title}</Heading>
          <Lead>{article.dek}</Lead>
          <div className="text-brand-muted flex flex-wrap gap-x-6 gap-y-1 text-lg">
            <span>{article.author}</span>
            <span className="tabular-nums">{article.date}</span>
            <span>{article.readingTime} read</span>
          </div>
        </BrandContainer>
      </section>

      <BrandContainer className="grid grid-cols-1 gap-12 py-20 md:grid-cols-12 md:gap-8 md:py-32">
        <nav className="hidden md:sticky md:top-32 md:col-span-6 md:flex md:h-[100vh] md:flex-col md:justify-center md:gap-2">
          {article.sections.map((section) => {
            const isActive = active === section.id
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={`flex items-baseline gap-3 text-lg transition-colors ${isActive ? 'text-brand-foreground' : 'text-brand-muted hover:text-brand-foreground'}`}
              >
                <span
                  className="bg-brand-foreground h-px w-6 self-center transition-opacity"
                  style={{ opacity: isActive ? 1 : 0 }}
                />
                {section.title}
              </a>
            )
          })}
        </nav>

        <div className="flex flex-col gap-16 md:col-span-6 md:gap-24">
          {article.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="border-brand-line flex scroll-mt-28 flex-col gap-6 border-t pt-8 first:border-t-0 first:pt-0"
            >
              <Heading className="text-2xl md:text-3xl">
                {section.title}
              </Heading>
              {section.paragraphs.map((paragraph, index) => (
                <Body
                  key={index}
                  className="text-xl leading-relaxed md:text-2xl"
                >
                  {paragraph}
                </Body>
              ))}
              {section.chart ? <Chart bars={section.chart} /> : null}
            </section>
          ))}
        </div>
      </BrandContainer>
    </>
  )
}
