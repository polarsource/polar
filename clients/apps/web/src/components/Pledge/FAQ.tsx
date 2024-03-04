import type { NextLayoutComponentType } from 'next'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from 'polarkit/components/ui/accordion'

interface FAQProps {
  question: string
  answer: string | JSX.Element
}

interface FAQItems extends Array<FAQProps> {}

const FAQ_BACKERS: FAQItems = [
  {
    question: 'Why does "Fund on completion" require GitHub login?',
    answer:
      'For pledges due upon completion vs. paid upfront, we want to offer the maintainer more visibility into who made the pledge for their assessment.',
  },
  {
    question: 'When is the invoice due for "Fund on completion"?',
    answer:
      'We send the invoice immediately when the issue is marked as completed. You then have 7 days before the invoice is due.',
  },
  {
    question: 'What happens if the issue is never completed?',
    answer: (
      <>
        <a
          href="https://docs.polar.sh/support"
          target="_blank"
          className="text-blue-400"
        >
          Contact our support
        </a>{' '}
        if nothing has happened within 6 months - we can help direct the pledge
        elsewhere or cancel it.
      </>
    ),
  },
  {
    question: 'Do I get any extra benefits by funding?',
    answer:
      'You get recognition of having funded the issue on Polar, but no additional benefits in terms of the code or initiative itself - unless the maintainer has explicitly communicated anything different.',
  },
  {
    question: 'Do I get progress updates?',
    answer:
      "It's not guaranteed and up to the individual maintainer to write updates in the GitHub issue.",
  },
]

const FAQ_CONTRIBUTOR: FAQItems = [
  {
    question: 'Do I get a reward?',
    answer:
      "You can in case the maintainer has setup a split with contributors and promoted it on this issue. But it always requires a review and approval from the maintainer so it's no guarantee.",
  },
  {
    question: 'Is rewards guaranteed?',
    answer:
      'No. In case funding is split with contributors, it still requires review & approval from maintainers before they grant rewards accordingly.',
  },
]

const FAQ_MAINTAINER: FAQItems = [
  {
    question: 'How can I get funding like this for my open source initiatives?',
    answer: (
      <>
        It&apos;s super easy. Signup via{' '}
        <a href="https://polar.sh" target="_blank" className="text-blue-400">
          Polar.sh
        </a>{' '}
        and we&apos;ll get you setup in no time. Questions? Checkout our{' '}
        <a
          href="https://docs.polar.sh/faq/maintainers"
          target="_blank"
          className="text-blue-400"
        >
          FAQ
        </a>{' '}
        to learn more.
      </>
    ),
  },
]

const FAQSection = (props: {
  title: string
  subtitle: string
  items: FAQItems
}) => {
  return (
    <>
      <div className="mb-10">
        <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
          {props.title}
        </h3>
        <p className="mb-2 text-gray-500">{props.subtitle}</p>

        <Accordion type="single" collapsible>
          {props.items.map((faq, index) => (
            <AccordionItem value={`backer-faq-${index}`} key={index}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </>
  )
}

const FAQ: NextLayoutComponentType = () => {
  return (
    <>
      <div className="w-full">
        <div className="relative mb-8 flex items-center">
          <div className="dark:border-polar-700 flex-grow border-t border-gray-200"></div>
          <span className="dark:text-polar-500 mx-4 flex-shrink text-gray-500">
            FAQ
          </span>
          <div className="dark:border-polar-700 flex-grow border-t border-gray-200"></div>
        </div>

        <FAQSection
          title="Backer"
          subtitle="You're funding impactful open source efforts"
          items={FAQ_BACKERS}
        />

        <FAQSection
          title="Contributor"
          subtitle="You want to contribute to this effort"
          items={FAQ_CONTRIBUTOR}
        />

        <FAQSection
          title="Maintainer"
          subtitle="You want to get funding like this too"
          items={FAQ_MAINTAINER}
        />
      </div>
    </>
  )
}

export default FAQ
