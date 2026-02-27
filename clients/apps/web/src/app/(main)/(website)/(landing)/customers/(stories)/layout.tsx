import GetStartedButton from '@/components/Auth/GetStartedButton'
import { Section } from '@/components/Landing/Section'
import ProseWrapper from '@/components/MDX/ProseWrapper'
import { PropsWithChildren } from 'react'

export const dynamic = 'force-static'
export const dynamicParams = false

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="flex flex-col items-center md:w-full">
      <div className="flex min-h-screen flex-col">
        {/* Main Content */}
        <main>
          <div className="mx-auto flex w-full max-w-6xl flex-col px-2 md:px-0">
            {/* Content Card */}
            <div className="dark:md:bg-polar-900 dark:border-polar-800 flex flex-col gap-y-8 rounded-lg border-gray-200 shadow-xs md:gap-y-12 md:border md:bg-white md:p-24 md:px-16">
              <ProseWrapper className="flex flex-col items-center md:w-full lg:max-w-6xl!">
                <div className="flex flex-col items-center">{children}</div>
              </ProseWrapper>
              <Section className="flex flex-col gap-y-24 border-t">
                <div className="flex flex-col items-center gap-y-8 text-center">
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  <h2 className="text-2xl md:text-3xl">
                    Ready to simplify your billing?
                  </h2>
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  <p className="dark:text-polar-500 text-lg text-balance text-gray-500 md:w-[480px]">
                    Join the best companies using Polar for their payments &
                    billing stack.
                  </p>
                  <GetStartedButton size="lg" text="Get Started" />
                </div>
              </Section>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
