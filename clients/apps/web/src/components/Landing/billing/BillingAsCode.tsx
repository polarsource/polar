import { SyntaxHighlighterClient } from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'

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
  ]),
  plugins: [
    FreeTrial({ days: 14 }),
    UsageCap({ maxDaily: 10_000 }),
    PercentageDiscount({ percent: 20 }),
  ],
});`

export const BillingAsCode = () => {
  return (
    <div className="dark:border-polar-700 flex-1 rounded-xl border border-gray-200">
      <div className="flex flex-row gap-x-4 px-4 py-3 font-mono text-xs">
        <span className="">terminal</span>
        <span className="dark:text-polar-500 text-gray-500">
          λ /src/billing_reducer.ts
        </span>
      </div>
      <div className="dark:bg-polar-900 z-1 rounded-xl bg-white p-4 text-sm">
        <SyntaxHighlighterClient lang="typescript" code={CODE} />
      </div>
    </div>
  )
}
