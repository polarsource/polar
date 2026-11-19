import { Chapter } from '../Chapter'
import { DocsLink } from '../integrate/DocsLink'
import { QuickstartFigure } from '../integrate/Quickstart'
import { ChargeFigure } from './ChargeFigure'
import { UnderstandFigure } from './UnderstandFigure'

/**
 * The landing page's story: one customer, Acme, followed through Polar. Each chapter zooms into one part of the
 * window the hero shows, with the same customer and the same numbers.
 */

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

export const Agents = () => (
  <Chapter
    id="agents"
    name="05 Agents"
    title="Billing, set up by your agent"
    subtitle="Three commands from install to checkout"
    description="Install the Polar CLI, let it give your coding agent the Polar MCP server and skills, then ask for billing. The agent signs you up, creates the products and wires checkout and webhooks with the SDK."
    cta={<DocsLink href="/integrate" label="Explore integrations" />}
  >
    <QuickstartFigure base="/integrate" />
  </Chapter>
)
