'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@polar-sh/ui/components/atoms/Accordion'

interface FAQItem {
  question: string
  answer: string
}

const FAQS: FAQItem[] = [
  {
    question: 'What is the Polar Startup Program?',
    answer:
      'A year of free Scale-tier billing for AI and SaaS startups. You get our lowest transaction fees, prioritized support, and a dedicated Slack channel with our team, all at no monthly cost for 12 months.',
  },
  {
    question: 'Who is eligible?',
    answer:
      'Early-stage startups building digital products: SaaS, AI, developer tools, and similar. We typically look for teams under 50 people who have raised less than $5M. Applications are reviewed case by case.',
  },
  {
    question: 'How can I apply?',
    answer:
      'Fill out the form on this page. We aim to respond within one business hour on weekdays. If you are a fit, we activate the free year on your Polar organization right away.',
  },
  {
    question: 'What does the program include?',
    answer:
      'The Scale plan, free for 12 months. That covers 3.40% + $0.30 transaction fees, and prioritized ticket and Slack support.',
  },
  {
    question: 'How long does the program last?',
    answer:
      '12 months from the day we activate it on your account. After that you can keep Scale at the standard $400/mo, switch to Pro or Growth, or move to the Starter tier with no commitment.',
  },
  {
    question: 'Can I switch plans during the program?',
    answer:
      'Yes. You can move between paid plans freely. Note that downgrading to Starter retires your free Scale benefit, so plan the switch with that in mind.',
  },
  {
    question: 'What happens after the year ends?',
    answer:
      'We send a 30-day notice before the program ends so you can pick the plan that fits where the business is by then.',
  },
  {
    question: 'I have more questions.',
    answer: 'Email us at support@polar.sh and we will get back to you shortly.',
  },
]

export const StartupProgramFAQ = () => {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }}
      gap={{ base: 'xl', md: '3xl' }}
    >
      <Text as="h2" variant="heading-l" wrap="balance">
        Questions and answers
      </Text>
      <Box display="block" gridColumn={{ md: 'span 2' }}>
        <Accordion type="multiple" className="flex flex-col">
          {FAQS.map((faq, i) => (
            <AccordionItem
              key={faq.question}
              value={`faq-${i}`}
              className="dark:border-polar-700 rounded-none! border-b border-gray-200 px-0!"
            >
              <AccordionTrigger className="py-6 text-left text-base hover:no-underline md:text-lg">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent>
                <Box display="block" paddingBottom="m" maxWidth="42rem">
                  <Text variant="body" color="muted">
                    {faq.answer}
                  </Text>
                </Box>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Box>
    </Box>
  )
}
