import Link, { LinkProps } from 'next/link'
import { LogoType } from 'polarkit/components/brand'
import { ComponentProps, PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import { UpsellFooter } from './UpsellFooter'

const Footer = ({ wide }: { wide?: boolean }) => {
  return (
    <div
      className={twMerge(
        'dark:border-polar-800 dark:bg-polar-900 border-gray-75 flex w-full flex-col items-center space-y-24 border-t bg-white py-24 md:py-32',
      )}
    >
      <UpsellFooter wide={wide} />
      <div
        className={twMerge(
          'flex w-full flex-col gap-x-16 gap-y-24 px-8 md:flex-row md:justify-between md:gap-y-12',
          wide ? 'max-w-7xl' : 'max-w-[970px]',
        )}
      >
        <div className="flex flex-col gap-y-6">
          <span className="text-blue-500 dark:text-blue-400">
            <LogoType />
          </span>
          <span className="dark:text-polar-500 text-gray-500">
            &copy; Polar Software Inc.
          </span>
        </div>
        <div
          className={twMerge(
            'flex flex-row flex-wrap gap-y-12 md:flex-row md:flex-nowrap',
            wide ? 'gap-x-24 lg:gap-x-32' : 'gap-x-20',
          )}
        >
          <div className="flex flex-col gap-y-6">
            <h3 className="dark:text-polar-50 text-base">Funding</h3>
            <div className="flex flex-col gap-y-2">
              <InternalLink href="/new">Fund an issue</InternalLink>
              <InternalLink href="/feed">Dashboard</InternalLink>
              <InternalLink href="/rewards">Rewards</InternalLink>
              <OutgoingLink href="https://docs.polar.sh">
                Documentation
              </OutgoingLink>
            </div>
          </div>
          <div className="flex flex-col gap-y-6">
            <h3 className="dark:text-polar-50 text-base">Company</h3>
            <div className="flex flex-col gap-y-2">
              <OutgoingLink href="/careers">Careers</OutgoingLink>
              <OutgoingLink href="https://blog.polar.sh">Blog</OutgoingLink>
              <OutgoingLink href="https://polarsource.github.io/legal/terms.pdf">
                Terms of Service
              </OutgoingLink>
              <OutgoingLink href="https://polarsource.github.io/legal/privacy-policy.pdf">
                Privacy Policy
              </OutgoingLink>
            </div>
          </div>
          <div className="flex flex-col gap-y-6">
            <h3 className="dark:text-polar-50 text-lg">Community</h3>
            <div className="flex flex-col gap-y-2">
              <OutgoingLink href="https://discord.gg/STfRufb32V">
                Join our Discord
              </OutgoingLink>
              <OutgoingLink href="https://github.com/polarsource">
                Github
              </OutgoingLink>
              <OutgoingLink href="https://x.com/polar_sh">
                X / Twitter
              </OutgoingLink>
            </div>
          </div>
          <div className="flex flex-col gap-y-6">
            <h3 className="dark:text-polar-50 text-base">Support</h3>
            <div className="flex flex-col gap-y-2">
              <OutgoingLink href="/faq">FAQ</OutgoingLink>
              <OutgoingLink href="mailto:support@polar.sh">
                Contact
              </OutgoingLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Footer

const InternalLink = (props: PropsWithChildren<LinkProps>) => {
  return (
    <Link
      className="flex flex-row items-center gap-x-1 text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
      {...props}
    >
      {props.children}
    </Link>
  )
}

const OutgoingLink = (props: ComponentProps<'a'>) => {
  return (
    <a
      className="flex flex-row items-center gap-x-1 text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
      {...props}
    />
  )
}
