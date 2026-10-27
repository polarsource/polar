import { Chapter } from '../Chapter'
import { AgentsFigure } from './AgentsFigure'
import { ChargeFigure } from './ChargeFigure'
import { DefineFigure } from './DefineFigure'
import { GrantFigure } from './GrantFigure'
import { MeasureFigure } from './MeasureFigure'
import { SellFigure } from './SellFigure'
import { UnderstandFigure } from './UnderstandFigure'

/**
 * The landing page's story: one customer, Acme, followed through Polar. Each chapter zooms into one part of the
 * window the hero shows, with the same customer and the same numbers.
 */

export const Define = () => (
  <Chapter
    id="define"
    name="01 Define"
    title="Build the pricing you need"
    subtitle="seats, credits, usage and tiers, in any mix"
    description="Charge per seat, sell a commitment that draws down credits, or bill pure usage on graduated tiers. Set it up in the dashboard, or from your code through the API, CLI or MCP."
  >
    <DefineFigure />
  </Chapter>
)

export const Grant = () => (
  <Chapter
    id="grant"
    name="02 Grant"
    title="Unlock what they paid for"
    subtitle="benefits, granted on purchase"
    description="Attach benefits like feature flags, credits or license keys to a product. Polar grants them on purchase and revokes them when the subscription ends."
  >
    <GrantFigure />
  </Chapter>
)

export const Measure = () => (
  <Chapter
    id="measure"
    name="03 Measure"
    title="Every event is metered"
    subtitle="the moment it happens"
    description="Send one event per model call, tool run or GPU second. Polar folds them into live meters per customer, and your app reads the result from one customer state call."
  >
    <MeasureFigure />
  </Chapter>
)

export const Charge = () => (
  <Chapter
    id="charge"
    name="02 Charge"
    title="One invoice for everything"
    subtitle="subscriptions, credits and usage together"
    description="Combine a base plan, prepaid credits and metered usage on one product. Polar draws credits down first, bills the overage and settles it at the end of the cycle."
  >
    <ChargeFigure />
  </Chapter>
)

export const Understand = () => (
  <Chapter
    id="understand"
    name="03 Understand"
    title="Know your margin"
    subtitle="for every customer, not just on average"
    description="Attach the inference cost to the events you already send. Polar collects the revenue, so it can put the two side by side and show the customer burning more than they pay."
  >
    <UnderstandFigure />
  </Chapter>
)

export const SellAnywhere = () => (
  <Chapter
    id="sell"
    name="06 Sell anywhere"
    title="Polar is the merchant of record"
    subtitle="the liability lands on our name, not yours"
    description="Sell in over 100 markets from day one. Sales tax, fraud, refunds and chargebacks are handled, and you withdraw your revenue to your bank account whenever you like."
  >
    <SellFigure />
  </Chapter>
)

export const Agents = () => (
  <Chapter
    id="agents"
    name="05 Agents"
    title="Run billing from your agent"
    subtitle="Polar in Claude, Cursor and ChatGPT over MCP"
    description="Connect the Polar MCP server and ask your agent about customers, usage and revenue, or have it create products, discounts and refunds. Signed in with OAuth, no API keys to paste."
  >
    <AgentsFigure />
  </Chapter>
)
