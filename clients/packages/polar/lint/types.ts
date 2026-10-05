import type { RuleTester } from 'oxlint/plugins-dev'

export type Rule = Extract<
  Parameters<RuleTester['run']>[1],
  { create: unknown }
>

export type Context = Parameters<Rule['create']>[0]

type Visitor = ReturnType<Rule['create']>

export type Node<Kind extends keyof Visitor> = Parameters<
  NonNullable<Visitor[Kind]>
>[0]
