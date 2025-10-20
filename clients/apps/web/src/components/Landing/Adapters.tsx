'use client'

import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import Check from '@mui/icons-material/Check'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import { motion } from 'framer-motion'
import Image from 'next/image'
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
    link: 'https://polar.sh/docs/integrate/sdk/adapters/nextjs',
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
    link: 'https://polar.sh/docs/integrate/sdk/adapters/better-auth',
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
    link: 'https://polar.sh/docs/api-reference/checkouts/create-session',
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
    return 'rounded-full! px-4 py-2 data-[state=active]:bg-white hidden md:flex'
  }, [])

  return (
    <SyntaxHighlighterProvider>
      <Tabs defaultValue={adapters[0].name}>
        <div className="flex w-full flex-col gap-y-16 md:h-full md:min-h-96">
          <div className="flex flex-col items-center gap-y-8">
            <span className="dark:text-polar-500 text-lg text-gray-400">
              Framework Adapters
            </span>
            <h1 className="w-fit max-w-2xl text-center text-3xl text-pretty md:text-5xl md:leading-normal">
              Integrate in under a minute
            </h1>
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
              <Link
                href="https://polar.sh/docs/integrate/sdk/adapters/nextjs"
                target="_blank"
              >
                <Button className="rounded-full" variant="ghost">
                  <span>All 13 Adapters</span>
                  <ArrowOutwardOutlined className="ml-2" />
                </Button>
              </Link>
            </TabsList>
          </div>
          {adapters.map((adapter) => (
            <TabsContent value={adapter.name} key={adapter.name}>
              <motion.div
                className={`dark:bg-polar-900 flex w-full flex-col overflow-hidden rounded-2xl bg-white md:flex-row md:rounded-4xl`}
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <div className="flex flex-col justify-center gap-y-8 p-8 md:w-1/2 md:p-16">
                  <div className="flex flex-col gap-y-8">
                    <motion.h2
                      className="text-2xl leading-normal! md:text-4xl"
                      variants={itemVariants}
                    >
                      {adapter.name} Adapter
                    </motion.h2>
                    <motion.p
                      className="text-lg leading-relaxed text-pretty"
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
                        <Check className="text-emerald-500" fontSize="small" />
                        <p className="leading-relaxed text-pretty">
                          Secure & Simple Checkouts
                        </p>
                      </motion.li>
                      <motion.li
                        className="flex flex-row items-center gap-x-2"
                        variants={itemVariants}
                      >
                        <Check className="text-emerald-500" fontSize="small" />
                        <p className="leading-relaxed text-pretty">
                          Integrated Customer Portal
                        </p>
                      </motion.li>
                      <motion.li
                        className="flex flex-row items-center gap-x-2"
                        variants={itemVariants}
                      >
                        <Check className="text-emerald-500" fontSize="small" />
                        <p className="leading-relaxed text-pretty">
                          Granular & Reliable Webhook Handler
                        </p>
                      </motion.li>

                      <motion.li
                        className="flex flex-row items-center gap-x-2"
                        variants={itemVariants}
                      >
                        <Check className="text-emerald-500" fontSize="small" />
                        <p className="leading-relaxed text-pretty">
                          Global Merchant of Record
                        </p>
                      </motion.li>
                    </ul>
                    <motion.span
                      className="text-sm text-gray-400"
                      variants={itemVariants}
                    >
                      <Link href={adapter.link} target="_blank">
                        <Button variant="secondary" className="rounded-full">
                          Learn More
                          <ArrowOutwardOutlined
                            fontSize="inherit"
                            className="ml-2"
                          />
                        </Button>
                      </Link>
                    </motion.span>
                  </div>
                </div>

                <div className="dark:bg-polar-800 relative flex flex-col justify-center bg-gray-100 p-8 text-sm md:w-1/2 md:p-16">
                  <Image
                    className="absolute inset-0 h-full w-full object-cover"
                    src="/assets/landing/abstract.jpg"
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 75vw, 640px"
                    loading="lazy"
                    alt=""
                  />
                  <div className="dark:bg-polar-900 z-1 rounded-lg bg-white p-4">
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
