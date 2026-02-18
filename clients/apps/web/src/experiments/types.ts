export interface ExperimentDefinition<V extends readonly string[]> {
  description: string
  variants: V
  defaultVariant: V[number]
  optOutOrgSlugs?: readonly string[]
}

export type ExperimentRegistry = Record<
  string,
  ExperimentDefinition<readonly string[]>
>
