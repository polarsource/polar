export type EventConfig = Record<string, never>

export type BenefitConfig = {
  id: string
}

export type MeterConfig = {
  id: string
  filter: {
    conjunction: 'and'
    clauses: readonly {
      conjunction: 'or'
      clauses: readonly {
        property: string
        operator: 'eq'
        value: string | number | boolean
      }[]
    }[]
  }
  aggregation: {
    func: 'count'
  }
}

export type RuntimeSDKConfig = {
  events?: Readonly<Record<string, EventConfig>>
  benefits?: Readonly<Record<string, BenefitConfig>>
  meters?: Readonly<Record<string, MeterConfig>>
}
