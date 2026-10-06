export type RuntimeSDKConfig = {
  events?: readonly {
    name: string
  }[]
  meters?: readonly {
    id: string
    external_id: string
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
  }[]
}

export type MeterConfig = NonNullable<RuntimeSDKConfig['meters']>[number]
