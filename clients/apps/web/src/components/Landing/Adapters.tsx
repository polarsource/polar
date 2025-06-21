'use client'

import { ArrowOutwardOutlined, Check } from '@mui/icons-material'
import { RawButton } from '@polar-sh/ui/components/atoms/Button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useMemo } from 'react'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'

const adapters = [
  {
    name: 'Next.js',
    code: `import { Checkout } from "@polar-sh/nextjs";

export const GET = Checkout({
  accessToken: 'xxx'
});`,
    link: 'https://docs.polar.sh/integrate/sdk/adapters/nextjs',
  },
  {
    name: 'BetterAuth',
    code: `import { betterAuth } from "better-auth";
import { polar, checkout, portal, usage, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";

const client = new Polar({ accessToken: 'xxx' });

const auth = betterAuth({
    // ... Better Auth config
    plugins: [
        polar({
            client,
            createCustomerOnSignUp: true,
            use: [
                checkout(...),
                portal(),
                usage(),
                webhooks(...)
            ],
        })
    ]
});`,
    link: 'https://docs.polar.sh/integrate/sdk/adapters/better-auth',
  },
  {
    name: 'TypeScript',
    code: `import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: 'xxx',
});

const checkout = await polar.checkouts.create({
  products: ["<PRODUCT_ID>"]
});

redirect(checkout.url)`,
    link: 'https://docs.polar.sh/api-reference/checkouts/create-session',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 1,
      staggerChildren: 0.05,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 1 } },
}

export const Adapters = () => {
  const tabsTriggerClassName = useMemo(() => {
    return '!rounded-full px-4 py-2 data-[state=active]:bg-white hidden md:flex'
  }, [])

  return (
    <SyntaxHighlighterProvider>
      <Tabs defaultValue={adapters[0].name}>
        <div className="flex w-full flex-col gap-y-16 md:h-full md:min-h-96">
          <div className="flex flex-col items-center gap-y-8">
            <span className="dark:text-polar-500 text-lg text-gray-400">
              Framework Adapters
            </span>
            <h3 className="w-fit max-w-2xl text-pretty text-center text-3xl md:text-5xl md:leading-normal">
              Integrate in under a minute
            </h3>
            <TabsList>
              {adapters.map((adapter) => (
                <TabsTrigger
                  key={adapter.name}
                  value={adapter.name}
                  className={tabsTriggerClassName}
                >
                  {adapter.name}
                </TabsTrigger>
              ))}
              <RawButton className="rounded-full" variant="ghost" asChild>
                <Link
                  href="https://docs.polar.sh/integrate/sdk/adapters/nextjs"
                  target="_blank"
                  className="outline-none focus:ring-[3px] focus:ring-blue-100 focus-visible:ring-blue-100 md:text-sm dark:text-white dark:ring-offset-transparent dark:focus:border-blue-600 dark:focus:ring-blue-700/40"
                >
                  <span>All 13 Adapters</span>
                  <ArrowOutwardOutlined className="ml-2" aria-hidden="true" />
                </Link>
              </RawButton>
            </TabsList>
          </div>
          {adapters.map((adapter) => (
            <TabsContent
              value={adapter.name}
              key={adapter.name}
              className="rounded-2xl focus-within:ring-[3px] focus-within:ring-blue-100 md:text-sm dark:text-white dark:ring-offset-transparent dark:focus-within:border-blue-600 dark:focus-within:ring-blue-700/40"
            >
              <motion.div
                className="dark:bg-polar-900 flex w-full flex-col overflow-hidden rounded-2xl bg-white md:flex-row"
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <div className="flex flex-col justify-center gap-y-8 p-8 md:w-1/2 md:p-16">
                  <div className="flex flex-col gap-y-8">
                    <motion.h4
                      className="text-2xl !leading-normal md:text-3xl"
                      variants={itemVariants}
                    >
                      {adapter.name} Adapter
                    </motion.h4>
                    <motion.p
                      className="text-pretty text-lg leading-relaxed"
                      variants={itemVariants}
                    >
                      Payments and Checkouts made dead simple with{' '}
                      {adapter.name}
                    </motion.p>
                    <ul className="flex flex-col gap-y-1">
                      <motion.li
                        className="flex flex-row items-center gap-x-2"
                        variants={itemVariants}
                      >
                        <Check
                          className="text-emerald-500"
                          fontSize="small"
                          aria-label="Check"
                        />
                        <p className="text-pretty leading-relaxed">
                          Secure & Simple Checkouts
                        </p>
                      </motion.li>
                      <motion.li
                        className="flex flex-row items-center gap-x-2"
                        variants={itemVariants}
                      >
                        <Check
                          className="text-emerald-500"
                          fontSize="small"
                          aria-label="Check"
                        />
                        <p className="text-pretty leading-relaxed">
                          Integrated Customer Portal
                        </p>
                      </motion.li>
                      <motion.li
                        className="flex flex-row items-center gap-x-2"
                        variants={itemVariants}
                      >
                        <Check
                          className="text-emerald-500"
                          fontSize="small"
                          aria-label="Check"
                        />
                        <p className="text-pretty leading-relaxed">
                          Granular & Reliable Webhook Handler
                        </p>
                      </motion.li>

                      <motion.li
                        className="flex flex-row items-center gap-x-2"
                        variants={itemVariants}
                      >
                        <Check
                          className="text-emerald-500"
                          fontSize="small"
                          aria-label="Check"
                        />
                        <p className="text-pretty leading-relaxed">
                          Global Merchant of Record
                        </p>
                      </motion.li>
                    </ul>
                    <motion.span
                      className="text-sm text-gray-400"
                      variants={itemVariants}
                    >
                      <RawButton
                        variant="secondary"
                        className="rounded-full"
                        asChild
                      >
                        <Link href={adapter.link} target="_blank">
                          Learn More
                          <ArrowOutwardOutlined
                            fontSize="inherit"
                            className="ml-2"
                            aria-hidden="true"
                          />
                        </Link>
                      </RawButton>
                    </motion.span>
                  </div>
                </div>

                <div
                  className="dark:bg-polar-800 flex flex-col justify-center bg-gray-100 p-8 text-sm md:w-1/2 md:p-16"
                  style={{
                    backgroundImage: 'url(/assets/landing/abstract.jpg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <div className="dark:bg-polar-900 rounded-lg bg-white p-4">
                    <SyntaxHighlighterClient
                      lang="typescript"
                      code={adapter.code}
                    />
                  </div>
                </div>
              </motion.div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </SyntaxHighlighterProvider>
  )
}
