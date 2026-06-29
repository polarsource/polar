'use client'

import Link from 'next/link'
import React, { useState } from 'react'
import { BrandContainer, Caption, Display } from '../Brand/primitives'
import { AdvisorResult } from './AdvisorResult'
import { Answers, questions } from './advisor'
import { Company } from './types'

const pad = (n: number) => `0${n}`.slice(-2)

function ChoiceList({
  questionId,
  selected,
  onSelect,
}: {
  questionId: string
  selected?: string
  onSelect: (value: string) => void
}) {
  const question = questions.find((q) => q.id === questionId)
  if (!question?.choices) return null

  return (
    <div className="flex flex-col">
      {question.choices.map((choice, index) => {
        const active = selected === choice.value
        return (
          <button
            key={choice.value}
            type="button"
            onClick={() => onSelect(choice.value)}
            className={`group flex w-full items-center gap-5 border-b py-6 text-left transition-colors ${
              active
                ? 'border-brand-foreground'
                : 'border-brand-line hover:border-brand-foreground'
            }`}
          >
            <span
              className={`text-xl transition-colors ${active ? 'text-brand-foreground' : 'text-brand-muted group-hover:text-brand-foreground'}`}
            >
              {String.fromCharCode(65 + index)}
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-brand-foreground text-2xl md:text-3xl">
                {choice.label}
              </span>
              {choice.hint ? <Caption>{choice.hint}</Caption> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function PricingAdvisor({ companies }: { companies: Company[] }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})

  const total = questions.length
  const done = index >= total
  const question = questions[index]
  const current = question ? (answers[question.id] ?? '') : ''

  const goNext = (value: string) => {
    if (!value.trim()) return
    setAnswers((prev) => ({ ...prev, [question.id]: value }))
    setIndex((i) => i + 1)
  }

  const restart = () => {
    setAnswers({})
    setIndex(0)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <BrandContainer className="flex items-center justify-between py-6 md:py-8">
        <Caption className="tabular-nums">
          {done ? 'Done' : `${pad(index + 1)} / ${pad(total)}`}
        </Caption>
        <Link
          href="/pricing-directory"
          className="text-brand-muted hover:text-brand-foreground text-lg transition-colors"
        >
          Close
        </Link>
      </BrandContainer>

      {!done && (
        <div className="bg-brand-line h-px w-full">
          <div
            className="bg-brand-foreground h-px transition-all"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
      )}

      {done ? (
        <AdvisorResult
          answers={answers}
          companies={companies}
          onRestart={restart}
        />
      ) : (
        <div className="flex grow items-center">
          <BrandContainer className="flex flex-col gap-12">
            <Display className="max-w-[18ch] text-4xl md:text-7xl">
              {question.prompt}
            </Display>

            {question.type === 'text' ? (
              <div className="flex flex-col gap-12">
                <input
                  autoFocus
                  value={current}
                  onChange={(event) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [question.id]: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') goNext(current)
                  }}
                  placeholder={question.placeholder}
                  className="text-brand-foreground placeholder:text-brand-muted w-full appearance-none border-none bg-transparent p-0 text-3xl tracking-tight outline-none focus:ring-0 md:text-5xl"
                />
                <Caption>Press Enter ↵</Caption>
              </div>
            ) : (
              <ChoiceList
                questionId={question.id}
                selected={current}
                onSelect={goNext}
              />
            )}

            {index > 0 ? (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                className="text-brand-muted hover:text-brand-foreground w-fit text-lg transition-colors"
              >
                ← Back
              </button>
            ) : null}
          </BrandContainer>
        </div>
      )}
    </div>
  )
}
