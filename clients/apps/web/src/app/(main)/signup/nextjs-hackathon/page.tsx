import GetStartedButton from '@/components/Auth/GetStartedButton'
import LogoIcon from '@/components/Brand/LogoIcon'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getLastVisitedOrg } from '@/utils/cookies'
import { getUserOrganizations } from '@/utils/user'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

const NextJSLogo = ({
  width = 100,
  height = 100,
}: {
  width?: number
  height?: number
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <mask
        id="a"
        style={{ maskType: 'alpha' }}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="100"
        height="100"
      >
        <circle
          cx="50"
          cy="50"
          r="50"
          fill="black"
          style={{ fill: 'black', fillOpacity: 1 }}
        />
      </mask>
      <g mask="url(#a)">
        <circle
          cx="50"
          cy="50"
          r="48.335"
          fill="black"
          stroke="white"
          style={{
            fill: 'black',
            fillOpacity: 1,
            stroke: 'white',
            strokeOpacity: 1,
          }}
          strokeWidth="3.33"
        />
        <path
          d="M83.06 87.5113L38.4122 30H30V69.9833H36.7298V38.5464L77.7773 91.5806C79.6293 90.3409 81.394 88.9808 83.06 87.5113Z"
          fill="url(#b)"
          style={{}}
        />
        <rect
          x="63.8887"
          y="30"
          width="6.66667"
          height="40"
          fill="url(#c)"
          style={{}}
        />
      </g>
      <defs>
        <linearGradient
          id="b"
          x1="60.5556"
          y1="64.7222"
          x2="80.2778"
          y2="89.1667"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            stopColor="white"
            style={{ stopColor: 'white', stopOpacity: 1 }}
          />
          <stop
            offset="0.604072"
            stopColor="white"
            stopOpacity="0"
            style={{ stopColor: 'none', stopOpacity: 0 }}
          />
          <stop
            offset="1"
            stopColor="white"
            stopOpacity="0"
            style={{ stopColor: 'none', stopOpacity: 0 }}
          />
        </linearGradient>
        <linearGradient
          id="c"
          x1="67.222"
          y1="30"
          x2="67.1104"
          y2="59.3751"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            stopColor="white"
            style={{ stopColor: 'white', stopOpacity: 1 }}
          />
          <stop
            offset="1"
            stopColor="white"
            stopOpacity="0"
            style={{ stopColor: 'none', stopOpacity: 0 }}
          />
        </linearGradient>
      </defs>
    </svg>
  )
}

const ResourceLinkItem = ({ href, title }: { href: string; title: string }) => {
  return (
    <li className="hover:bg-polar-200 cursor-default px-1 hover:text-black">
      <a href={href}>{title}</a>
    </li>
  )
}

const RightColumn = () => {
  return (
    <div>
      <div
        className={twMerge(
          'relative flex h-auto w-full flex-col md:w-auto md:self-start',
        )}
      >
        <div className="border-polar-600 absolute left-2 top-2 h-full w-full transform border md:left-4 md:top-4" />
        <div className="border-polar-200 bg-polar-900 relative w-full border-2">
          <div className="bg-polar-200 flex flex-row justify-between px-2 py-1 text-xs text-black">
            <span className="font-bold">Terminal</span>
            <span className="mb-1 h-0.5 w-2 self-end bg-black" />
          </div>
          <div className="flex flex-col overflow-auto p-4 font-mono text-sm">
            <pre className="flex flex-col gap-y-2 pb-4">
              <code>$ npx polar-init</code>
              <code className="text-polar-500">
                # Scaffolding Polar integration in local Next.js codebase
              </code>
              <code className="text-polar-500">
                &gt;{` `}
                <a
                  href="https://docs.polar.sh/guides/nextjs"
                  className="underline"
                >
                  https://docs.polar.sh/guides/nextjs
                </a>
              </code>
            </pre>
          </div>
        </div>
      </div>
      <div className="relative mt-8 flex h-auto w-full flex-col md:w-auto md:self-start">
        <div className="border-polar-600 absolute left-2 top-2 h-full w-full transform border md:left-4 md:top-4" />
        <div className="border-polar-200 bg-polar-900 relative w-full border-2">
          <div className="bg-polar-200 flex flex-row justify-between px-2 py-1 text-xs text-black">
            <span className="font-bold">$ cat src/app/checkout/route.ts</span>
            <span className="mb-1 h-0.5 w-2 self-end bg-black" />
          </div>
          <div className="flex flex-col overflow-auto p-4 font-mono text-sm">
            <SyntaxHighlighterProvider>
              <SyntaxHighlighterClient
                lang="js"
                code={`import { Checkout } from '@polar-sh/nextjs'

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  successUrl: process.env.SUCCESS_URL
})
`}
                customThemeConfig={{
                  light: 'poimandres',
                  dark: 'poimandres',
                }}
              />
            </SyntaxHighlighterProvider>
          </div>
        </div>
      </div>
      <div className="relative mt-8 flex h-auto w-full flex-col md:w-auto md:self-start">
        <div className="border-polar-600 absolute left-2 top-2 h-full w-full transform border md:left-4 md:top-4" />
        <div className="border-polar-200 bg-polar-900 relative w-full border-2">
          <div className="bg-polar-200 flex flex-row justify-between px-2 py-1 text-xs text-black">
            <span className="font-bold">
              $ cat src/app/api/webhook/polar/route.ts
            </span>
            <span className="mb-1 h-0.5 w-2 self-end bg-black" />
          </div>
          <div className="flex flex-col overflow-auto p-4 font-mono text-sm">
            <SyntaxHighlighterProvider>
              <SyntaxHighlighterClient
                lang="js"
                code={`import { Webhooks } from '@polar-sh/nextjs'

export const POST = Webhooks({
	webhookSecret: process.env.POLAR_WEBHOOK_SECRET,
	onPayload: async (payload) => // Handle payload...
});
`}
                customThemeConfig={{
                  light: 'poimandres',
                  dark: 'poimandres',
                }}
              />
            </SyntaxHighlighterProvider>
          </div>
        </div>
      </div>
      <ul className="mt-12">
        <ResourceLinkItem
          href="https://docs.polar.sh/introduction"
          title="00. Docs"
        />
        <ResourceLinkItem
          href="https://docs.polar.sh/api-reference"
          title="01. API Reference"
        />
        <ResourceLinkItem
          href="https://discord.gg/BZw96tszTX"
          title="02. Discord"
        />
        <ResourceLinkItem
          href="https://github.com/polarsource/polar"
          title="03. GitHub"
        />
        <ResourceLinkItem href="https://x.com/polar_sh" title="04. X/Twitter" />
      </ul>
    </div>
  )
}

export default async function Page() {
  const api = getServerSideAPI()
  const userOrganizations = await getUserOrganizations(api)

  if (userOrganizations.length > 0) {
    const org = userOrganizations.find(
      (org) => org.slug === getLastVisitedOrg(cookies()),
    )

    const targetOrg = org?.slug ?? userOrganizations[0].slug

    redirect(`/dashboard/${targetOrg}`)
  }

  const desktopClasses = 'md:flex-row md:gap-x-32'

  return (
    <div className="flex h-full flex-col justify-between gap-y-12 text-sm">
      <div className="relative flex flex-grow flex-col gap-y-16">
        <div
          className={twMerge(desktopClasses, 'mb-16 flex flex-col gap-y-16')}
        >
          <div className="flex max-w-lg flex-col gap-y-8">
            <div className="flex flex-row items-center gap-x-2">
              <LogoIcon />
              <p className="mr-1">+</p>
              <NextJSLogo width={25} height={25} />
            </div>
            <div className="flex flex-row items-center gap-x-4">
              <span className="bg-polar-200 px-1 py-0.5 text-sm leading-none text-black">
                &gt;_
              </span>
              <h1 className="text-lg">Next.js April 2025 Hackathon</h1>
            </div>
            <h1 className="text-balance text-4xl leading-tight">
              Ship faster. Earn more.
            </h1>
            <div className="flex flex-col gap-y-8 text-justify">
              <div>
                <strong>
                  Polar is purpose built for Next.js developers monetizing SaaS
                  or digital products.
                </strong>
                <p className="mt-2">- Integration in one command or 5 LOCs.</p>
                <p>
                  -{' '}
                  <a
                    href="https://docs.polar.sh/integrate/customer-state"
                    className="text-blue-300"
                  >
                    One webhook
                  </a>{' '}
                  vs. hundreds to care about
                </p>
                <p>- Built-in and automated entitlements to easily sell:</p>
                <p className="ml-4"> * License keys &amp; validation</p>
                <p className="ml-4"> * File downloads</p>
                <p className="ml-4"> * GitHub Repository Access</p>
                <p className="ml-4"> * Discord Roles &amp; Access</p>
                <p>
                  - Merchant of Record. We handle international sales taxes.
                </p>
                <p>- Trusted by thousands of developers world-wide</p>
                <p>- Built open-source and with Next.js</p>
              </div>
              <div>
                <div className="border border-gray-700 text-center font-mono">
                  <p className="mt-4 text-xl">0% + $0 / transaction*</p>
                  <p className="mb-4 mt-2 text-xs">
                    + International-, billing- and payout{` `}
                    <a
                      href="https://docs.polar.sh/merchant-of-record/fees"
                      className="text-blue-300"
                    >
                      fees
                    </a>
                    .
                  </p>
                  <div className="mx-auto mt-2 bg-black p-4 text-xs">
                    <strong>* Standard fees (4% + $0.4) after May 31st</strong>
                    <p>
                      Or once the Next.js Global Hackathon cohort combined sells
                      for $500,000 or 10,000 orders - whichever comes first.
                    </p>
                  </div>
                </div>
              </div>
              <GetStartedButton
                fullWidth
                size="lg"
                text="Get Started"
                className="bg-polar-200 hover:bg-polar-300 rounded-none font-bold text-black hover:text-black"
              />
            </div>
          </div>
          <RightColumn />
        </div>
      </div>
    </div>
  )
}
