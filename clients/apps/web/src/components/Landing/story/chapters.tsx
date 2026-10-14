import { Chapter } from '../Chapter'
import { AgentsFigure } from './AgentsFigure'
import { ChargeFigure } from './ChargeFigure'
import { DefineFigure } from './DefineFigure'
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
    title="Pricing is code"
    subtitle="checked in next to the product it prices"
    description="Plans, meters and credits live in one config file. Change a price in a pull request, preview it against real usage, ship it like any other change."
  >
    <DefineFigure />
  </Chapter>
)

export const Measure = () => (
  <Chapter
    id="measure"
    name="02 Measure"
    title="Every event is metered"
    subtitle="the moment it happens"
    description="Send one event per model call, tool run or GPU second. Polar folds them into live meters per customer, and answers entitlement checks next to your code with no network round trip."
  >
    <MeasureFigure />
  </Chapter>
)

export const Charge = () => (
  <Chapter
    id="charge"
    name="03 Charge"
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
    name="04 Understand"
    title="Know your margin"
    subtitle="per customer, per model, per feature"
    description="Polar collects the revenue, so placing inference cost beside it shows your real gross margin. The customer burning more tokens than they pay for stops hiding in your averages."
  >
    <UnderstandFigure />
  </Chapter>
)

export const SellAnywhere = () => (
  <Chapter
    id="sell"
    name="05 Sell anywhere"
    title="Polar is the merchant of record"
    subtitle="the liability lands on our name, not yours"
    description="Sell in over 100 markets from day one. Sales tax, fraud, refunds and chargebacks are handled, and revenue settles to your bank account on your schedule."
  >
    <SellFigure />
  </Chapter>
)

export const Agents = () => (
  <Chapter
    id="agents"
    name="06 Agents"
    title="Bill the agents too"
    subtitle="each with its own meters, credits and limits"
    description="Acme runs agents on your product. Give each one its own identity, meter its usage, cap its spend, and roll it all up to the customer who pays."
  >
    <AgentsFigure />
  </Chapter>
)
