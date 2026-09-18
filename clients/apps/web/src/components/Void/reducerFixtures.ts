import {
  ReducerFilter,
  VoidMeterDefinition,
  VoidReducerAggregation,
  VoidReducerDefinition,
} from './reducers'

const CREATED = '2026-03-01T00:00:00.000Z'

function named(name: string): ReducerFilter {
  return {
    conjunction: 'and',
    clauses: [{ property: 'name', operator: 'eq', value: name }],
  }
}

function reducer(
  id: string,
  slug: string,
  type: 'scalar' | 'dict',
  filter: ReducerFilter | null,
  aggregation: VoidReducerAggregation,
): VoidReducerDefinition {
  return { id, slug, type, filter, aggregation, created_at: CREATED }
}

function meter(
  id: string,
  name: string,
  slug: string,
  usageReducerId: string,
  unitAmount: string,
): VoidMeterDefinition {
  return {
    id,
    name,
    slug,
    usage_reducer_id: usageReducerId,
    credit_reducer_id: 'reducer_8',
    unit_amount: unitAmount,
    currency: 'usd',
  }
}

export const FIXTURE_REDUCERS: VoidReducerDefinition[] = [
  reducer('reducer_1', 'output_tokens', 'scalar', named('llm.completion'), {
    func: 'sum',
    property: 'output_tokens',
  }),
  reducer('reducer_2', 'input_tokens', 'scalar', named('llm.completion'), {
    func: 'sum',
    property: 'input_tokens',
  }),
  reducer('reducer_3', 'tool_calls', 'scalar', named('tool.call'), {
    func: 'count',
  }),
  reducer('reducer_4', 'sandbox_minutes', 'scalar', named('sandbox.stopped'), {
    func: 'sum',
    property: 'minutes',
  }),
  reducer('reducer_5', 'spend', 'scalar', named('order.paid'), {
    func: 'sum',
    property: 'amount',
  }),
  reducer('reducer_6', 'last_completion', 'dict', named('llm.completion'), {
    func: 'last',
  }),
  reducer('reducer_7', 'tokens_per_call', 'scalar', null, {
    func: 'derive',
    expression: 'input_tokens / tool_calls',
    inputs: { input_tokens: 'input_tokens', tool_calls: 'tool_calls' },
  }),
  reducer('reducer_8', 'credits', 'scalar', named('meter.credited'), {
    func: 'sum',
    property: 'units',
  }),
]

export const FIXTURE_METERS: VoidMeterDefinition[] = [
  meter('meter_1', 'Output tokens', 'output-tokens', 'reducer_1', '0.003'),
  meter('meter_2', 'Input tokens', 'input-tokens', 'reducer_2', '0.0005'),
  meter('meter_3', 'Tool calls', 'tool-calls', 'reducer_3', '0.1'),
  meter('meter_4', 'Sandbox minutes', 'sandbox-minutes', 'reducer_4', '2'),
]
