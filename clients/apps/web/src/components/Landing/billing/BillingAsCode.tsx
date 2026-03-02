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
    <div className="dark:border-polar-700 flex-1 rounded-2xl border border-gray-200 p-1">
      <div className="flex flex-row gap-x-4 px-4 py-3 font-mono text-xs">
        <span className="">terminal</span>
        <span className="dark:text-polar-500 text-gray-500">λ</span>
        <span className="dark:text-polar-500 text-gray-500">
          src/billing_reducer.ts
        </span>
      </div>
      <div className="dark:bg-polar-900 z-1 rounded-xl bg-white p-4 text-sm">
        <SyntaxHighlighterClient lang="typescript" code={CODE} />
      </div>
      <div className="flex flex-col gap-y-1 px-4 py-3">
        <div className="flex flex-row gap-x-4 font-mono text-xs">
          <span className="">polar deploy src/billing_reducer.ts</span>
        </div>
        <div className="dark:text-polar-500 flex flex-col gap-y-1 font-mono text-xs text-gray-500">
          <p className="">λ Deploying billing lambda...</p>
          <p className="">λ Billing lambda lk2m3424 deployed (2.1kB / 36ms)</p>
        </div>
      </div>
    </div>
  )
}
