import Link, { LinkProps } from 'next/link'
import { LogoType } from 'polarkit/components/brand'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import { UpsellFooter } from './UpsellFooter'

const Footer = ({
  wide,
  showUpsellFooter,
}: {
  wide?: boolean
  showUpsellFooter: boolean
}) => {
  return (
    <div
      className={twMerge(
        'dark:border-polar-800 dark:bg-polar-900 border-gray-75 flex w-full flex-col items-center space-y-24 border-t bg-white py-24 md:py-32',
      )}
    >
      {showUpsellFooter ? <UpsellFooter wide={wide} /> : null}

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
            <h3 className="dark:text-polar-50 text-base">Creators</h3>
            <div className="flex flex-col gap-y-2">
              <FooterLink href="https://api.polar.sh/api/v1/integrations/github/authorize?return_to=%2Fmaintainer&user_signup_type=maintainer">
                Create an Account
              </FooterLink>
              <FooterLink href="https://docs.polar.sh/payment">
                Pricing
              </FooterLink>
              <FooterLink href="https://docs.polar.sh/maintainers/posts">
                Posts & Newsletter
              </FooterLink>
              <FooterLink href="https://docs.polar.sh/maintainers/issue-funding">
                Issue Funding
              </FooterLink>
            </div>
          </div>
          <div className="flex flex-col gap-y-6">
            <h3 className="dark:text-polar-50 text-base">Company</h3>
            <div className="flex flex-col gap-y-2">
              <FooterLink href="/careers">Careers</FooterLink>
              <FooterLink href="https://blog.polar.sh">Blog</FooterLink>
              <FooterLink href="/assets/brand/polar_brand.zip">
                Brand Assets
              </FooterLink>
              <FooterLink href="https://polarsource.github.io/legal/terms.pdf">
                Terms of Service
              </FooterLink>
              <FooterLink href="https://polarsource.github.io/legal/privacy-policy.pdf">
                Privacy Policy
              </FooterLink>
            </div>
          </div>
          <div className="flex flex-col gap-y-6">
            <h3 className="dark:text-polar-50 text-lg">Community</h3>
            <div className="flex flex-col gap-y-2">
              <FooterLink href="https://discord.gg/STfRufb32V">
                Join our Discord
              </FooterLink>
              <FooterLink href="https://github.com/polarsource">
                GitHub
              </FooterLink>
              <FooterLink href="https://x.com/polar_sh">X / Twitter</FooterLink>
            </div>
          </div>
          <div className="flex flex-col gap-y-6">
            <h3 className="dark:text-polar-50 text-base">Support</h3>
            <div className="flex flex-col gap-y-2">
              <FooterLink href="https://docs.polar.sh/">Docs</FooterLink>
              <FooterLink href="https://docs.polar.sh/faq/">FAQ</FooterLink>
              <FooterLink href="mailto:support@polar.sh">Contact</FooterLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Footer

const FooterLink = (props: PropsWithChildren<LinkProps>) => {
  return (
    <Link
      className="flex flex-row items-center gap-x-1 text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
      {...props}
    >
      {props.children}
    </Link>
  )
}
