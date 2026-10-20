import { Contents } from '@/components/FieldGuide/Contents'
import { Button } from '@polar-sh/orbit'
import Link from 'next/link'
import { Chapter } from '../Chapter'

/** Early access to what we are building next: a way to ask for it, and the field guide that explains it. */
export const FieldGuide = () => (
  <Chapter
    id="field-guide"
    name="New Usage Engine"
    nameNote="Coming soon"
    title="Agent-first billing, in early access"
    subtitle="a first look at our new usage billing engine"
    description="Billing as code, zero-latency checks and simulations before you ship a price. Read how it works, and join the first teams building on it."
    cta={
      <>
        <Link href="/field-guide" prefetch>
          <Button>Read the field guide</Button>
        </Link>
        <Link href="/field-guide#early-access">
          <Button variant="ghost">Request early access</Button>
        </Link>
      </>
    }
  >
    <Contents linked />
  </Chapter>
)
