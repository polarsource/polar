import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { CheckOutlined, ChevronRight } from '@mui/icons-material'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import { useUpsellSteps } from './useUpsellSteps'

export const CreatorUpsell = () => {
  const { organization } = useContext(MaintainerOrganizationContext)
  const steps = useUpsellSteps()

  return (
    <div className="flex flex-col items-center gap-y-16 py-16">
      <div className="flex flex-col items-center gap-y-4 text-center">
        <h3 className="text-3xl">Welcome to Polar!</h3>
        <p className="dark:text-polar-400 text-gray-500">
          Let&apos;s get up to speed by completing a few simple steps
        </p>
      </div>
      <div className="flex w-full max-w-3xl flex-col gap-y-12">
        <div className="flex flex-col gap-y-4">
          {steps.map((card, i) => (
            <UpsellStep key={card.title} {...card} index={i + 1} />
          ))}
        </div>
        <ShadowBox className="flex flex-col gap-y-8 p-10">
          <div className="flex flex-col gap-y-2">
            <h3 className="text-xl">Build with the Polar API</h3>
            <p className="dark:text-polar-400 text-gray-500">
              Integrate Polar products with your own platform using our API
            </p>
          </div>
          <div className="flex flex-col">
            <pre className="dark:border-polar-700 dark:bg-polar-950 rounded-3xl border p-4 text-sm">
              <SyntaxHighlighterProvider>
                <SyntaxHighlighterClient
                  lang="javascript"
                  code={`import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env["POLAR_ACCESS_TOKEN"] ?? "",
});

(async () => {
  const result = await polar.products.list({
    organizationId: "${organization.id}",
  });
  
  for await (const page of result) {
    // Handle the page
    console.log(page);
  }
})();`}
                />
              </SyntaxHighlighterProvider>
            </pre>
          </div>
          <Link href={`/docs/api`} target="_blank">
            <Button wrapperClassNames="flex flex-row items-center gap-x-2">
              <span>API Documentation</span>
              <ChevronRight className="text-sm" fontSize="inherit" />
            </Button>
          </Link>
        </ShadowBox>
      </div>
    </div>
  )
}

export interface UpsellStepProps {
  title: string
  description: string
  href: string
  newTab?: boolean
  done?: boolean
  CTA: string
  index: number
}

export const UpsellStep = ({
  title,
  description,
  href,
  newTab,
  done,
  index,
  CTA,
}: UpsellStepProps) => {
  return (
    <ShadowBox className="dark:hover:bg-polar-800 relative flex h-full flex-row items-center justify-between gap-x-6 transition-colors hover:bg-gray-50">
      <div className="flex flex-row items-center gap-x-6">
        {done ? (
          <div className="flex h-8 w-8 flex-shrink-0 cursor-pointer flex-col items-center justify-center rounded-full bg-blue-500 text-white">
            <CheckOutlined fontSize="inherit" />
          </div>
        ) : (
          <div className="dark:bg-polar-700 flex h-8 w-8 flex-shrink-0 flex-col items-center justify-center rounded-full bg-gray-100 text-sm text-gray-500 dark:text-white">
            {index}
          </div>
        )}
        <div className={twMerge('flex flex-col gap-y-1', done && 'opacity-30')}>
          <h3 className="font-medium [text-wrap:balance]">{title}</h3>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            {description}
          </p>
        </div>
      </div>
      <Link
        href={done ? '#' : href}
        className="relative"
        target={newTab ? '_blank' : '_self'}
      >
        <Button disabled={done}>{CTA}</Button>
      </Link>
    </ShadowBox>
  )
}
