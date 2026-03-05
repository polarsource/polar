import { Terminal } from '../Terminal'

const CODE = `const llmMeter = defineMeter({
  name: "llm",
  initialState: { tokens: 0, calls: 0 },
  reduce(state, event) {
    return {
      tokens: state.tokens + event.metadata._llm.totalTokens,
      calls: state.calls + 1,
    };
  },
  projection: (state) => state.tokens,
});

export default defineBilling({
  meter: llmMeter,
  pricing: TieredUsage([
    { upTo: 1_000_000, unitPrice: 0 },
    { upTo: 10_000_000, unitPrice: 0.0002 },
    { unitPrice: 0.0001 },
  ])
});`

export const BillingAsCode = () => {
  return (
    <Terminal
      title="terminal"
      subtitle="src/billing_reducer.ts"
      content={CODE}
      footer={[
        { command: 'polar deploy src/billing_reducer.ts', type: 'input' },
        { command: 'Deploying billing lambda...', type: 'output' },
        {
          command: 'Billing lambda lk2m3424 deployed (2.1kB / 36ms)',
          type: 'output',
        },
      ]}
    />
  )
}
