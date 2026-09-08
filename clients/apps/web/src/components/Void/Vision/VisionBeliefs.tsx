import { Paragraph, VisionChapter } from './VisionProse'

export const VisionProblem = () => (
  <VisionChapter name="Context">
    <Paragraph>
      Billing systems were designed for a world where a customer was a person, a
      product was a seat, and a price was decided once a year.
    </Paragraph>
    <Paragraph>
      AI products are consumed by the token, by agents nobody is watching. Costs
      move hourly. Pricing gets rewritten in a week. The software underneath
      still overwrites a record and forgets what it knew a moment ago.
    </Paragraph>
    <Paragraph>
      We built ours that way too. It worked, until customers started asking why.
    </Paragraph>
    <Paragraph>
      The deeper problem is what these systems think they are for. They exist to
      produce an invoice. Everything else, what a customer has used, what they
      are entitled to, what it cost you to serve them, is a by-product, stored
      somewhere else, reconciled at the end of the month.
    </Paragraph>
    <Paragraph>
      In a world where your product has to decide, on every request, whether an
      agent is allowed to keep going, that is backwards.
    </Paragraph>
  </VisionChapter>
)

export const VisionBeliefs = () => (
  <VisionChapter name="Thesis">
    <Paragraph>
      We believe the customer state is a function over an event log. Not a
      record you update, but a state you derive.
    </Paragraph>
    <Paragraph>
      Usage, entitlements, balance, margin: all of it should fall out of one
      history, and your product should be able to read that state at any moment
      without asking anyone.
    </Paragraph>
    <Paragraph>
      Billing is a side effect of that state. An invoice is what falls out when
      the state crosses a boundary. Get the state right and the charge takes
      care of itself.
    </Paragraph>
    <Paragraph>
      Margin belongs in the same place as revenue. A billing platform that only
      knows what you charged knows half of your business, and for an AI company
      it is the less interesting half.
    </Paragraph>
    <Paragraph>
      And before long, agents will run your pricing. They will watch costs move,
      test a hundred strategies overnight, and ship the one that holds margin.
      That is only possible, and only safe, on a history that can be replayed.
    </Paragraph>
    <Paragraph>
      Interfaces went through this once. Screens were mutated in place until
      nobody could say what state they were in. Then React invented UI =
      fn(state), and a whole class of bugs became impossible. The customer has
      the same shape.
    </Paragraph>
  </VisionChapter>
)
