'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import DonutLargeOutlined from '@mui/icons-material/DonutLargeOutlined'
import SpeedOutlined from '@mui/icons-material/SpeedOutlined'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Hero } from '../Hero/Hero'
import { Section } from '../Section'

const llmCode = `import { Ingestion } from "@polar-sh/ingestion";
import { LLMStrategy } from "@polar-sh/ingestion/strategies/LLM";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const llmIngestion = Ingestion({ accessToken: 'xxx' })
  .strategy(new LLMStrategy(openai("gpt-4o")))
  .ingest("openai-usage");

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();

  const model = llmIngestion.client({
    externalCustomerId: "<USER_ID_FROM_YOUR_DATABASE>",
  });

  const { text } = await generateText({
    model,
    system: "You are a helpful assistant.",
    prompt,
  });

  return Response.json({ text });
}`

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 1 } },
}

export const UsageBillingPage = () => {
  return (
    <SyntaxHighlighterProvider>
      <div className="flex flex-col">
        <Section className="flex flex-col gap-y-32 pt-0 md:pt-0">
          <Hero
            title="Usage Billing on Steroids"
            description="Leverage our Event Ingestion Strategies to track any usage with precision"
          >
            <GetStartedButton size="lg" text="Get Started" />
          </Hero>

          <motion.div
            className="dark:bg-polar-900 flex w-full flex-col overflow-hidden rounded-2xl bg-white md:flex-row-reverse md:items-stretch"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
          >
            <div className="flex flex-1 grow flex-col gap-y-10 p-8 md:p-16">
              <div className="flex flex-col gap-y-4">
                <div className="flex items-center gap-x-3">
                  <h2 className="leading-normal! text-2xl md:text-3xl">
                    Track any metric with precision
                  </h2>
                </div>
                <p className="dark:text-polar-500 text-lg text-gray-500">
                  Use our Ingestion Strategies to track any usage with
                  precision.
                </p>
              </div>
              <motion.ul
                className="dark:divide-polar-700 dark:border-polar-700 flex flex-col divide-y divide-gray-200 border-y border-gray-200"
                variants={containerVariants}
              >
                {[
                  'Real-time usage & aggregation',
                  'Multiple aggregation functions',
                  'Strategies or manual Event Ingestion',
                  'Built for scale, precision & accuracy',
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    className="flex items-start gap-x-3 py-2"
                    variants={itemVariants}
                  >
                    <CheckOutlined
                      className="mt-0.5 text-emerald-500"
                      fontSize="small"
                    />
                    <span>{item}</span>
                  </motion.li>
                ))}
              </motion.ul>
            </div>
            <div className="dark:bg-polar-800 relative flex flex-1 items-center justify-center bg-gray-100 p-8 md:p-16">
              <Image
                className="absolute inset-0 h-full w-full object-cover"
                src="/assets/landing/abstract_02.jpg"
                alt="Usage Billing"
                width={500}
                height={500}
              />
              <div className="dark:bg-polar-900 z-10 rounded-lg bg-white p-4 text-sm">
                <SyntaxHighlighterClient lang="typescript" code={llmCode} />
              </div>
            </div>
          </motion.div>

          <Hero
            title="Flexible pricing models"
            description="From simple per-unit pricing to complex tiered and volume-based models"
          >
            <div className="grid flex-1 grid-cols-1 gap-8 md:grid-cols-3">
              {[
                {
                  icon: <TrendingUpOutlined fontSize="large" />,
                  title: 'Tiered Pricing',
                  description:
                    'Charge different rates based on usage tiers. Perfect for encouraging growth.',
                },
                {
                  icon: <SpeedOutlined fontSize="large" />,
                  title: 'Volume Pricing',
                  description:
                    'Apply discounts based on total volume. Incentivize higher usage automatically.',
                },
                {
                  icon: <DonutLargeOutlined fontSize="large" />,
                  title: 'Hybrid Models',
                  description:
                    'Combine subscription fees with usage charges for predictable revenue.',
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="dark:bg-polar-900 flex flex-col items-center gap-y-8 rounded-xl bg-gray-50 px-6 py-12 text-center"
                >
                  <div className="flex flex-row gap-x-2">{feature.icon}</div>
                  <div className="flex flex-col gap-y-4">
                    <h3 className="text-2xl">{feature.title}</h3>
                    <p className="dark:text-polar-400 text-balance text-gray-600">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Hero>
        </Section>

        <Section className="flex flex-col gap-y-24">
          <motion.div
            className="flex flex-col items-center gap-y-8 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
          >
            <motion.h2 className="text-2xl md:text-3xl" variants={itemVariants}>
              Ready to implement usage billing?
            </motion.h2>
            <motion.p
              className="dark:text-polar-500 text-lg text-gray-500 md:w-[480px]"
              variants={itemVariants}
            >
              Join companies that trust Polar for accurate, scalable usage-based
              billing.
            </motion.p>
            <motion.div variants={itemVariants}>
              <GetStartedButton size="lg" text="Get Started" />
            </motion.div>
          </motion.div>
        </Section>
      </div>
    </SyntaxHighlighterProvider>
  )
}
