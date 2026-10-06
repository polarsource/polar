export type EventConfig = Record<string, never>

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
  // Keyed by event name
  events?: Readonly<Record<string, EventConfig>>
  // Keyed by meter external ID
  meters?: Readonly<Record<string, MeterConfig>>
}
