import Link, { LinkProps } from 'next/link'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import { BrandingMenu } from '../Layout/Public/BrandingMenu'

const Footer = ({ wide }: { wide?: boolean }) => {
  return (
    <div
      className={twMerge(
        'flex w-full flex-col items-center space-y-24 px-4 py-16',
      )}
    >
      <div
        className={twMerge(
          'dark:md:bg-polar-900 md:rounded-4xl flex w-full flex-col gap-x-32 gap-y-24 md:justify-between md:gap-y-12 md:bg-gray-50 md:p-16 lg:flex-row',
          wide ? 'max-w-7xl' : 'max-w-[970px]',
        )}
      >
        <div className="flex flex-grow flex-col gap-y-6">
          <span className="ml-2 text-black md:ml-0 dark:text-white">
            <BrandingMenu logoVariant="logotype" size={120} />
          </span>
          <span className="dark:text-polar-500 w-full flex-grow text-gray-500">
            &copy; Polar Software Inc. {new Date().getFullYear()}
          </span>
        </div>
        <div
          className={twMerge(
            'flex flex-col gap-x-12 gap-y-12 text-sm md:flex-row [&>div]:w-36',
          )}
        >
          <div className="flex flex-col gap-y-4">
            <h3 className="text-base dark:text-white">Platform</h3>
            <div className="flex flex-col gap-y-2">
              <FooterLink href="https://api.polar.sh/v1/integrations/github/authorize?return_to=%2Fmaintainer&user_signup_type=maintainer">
                Create an Account
              </FooterLink>
              <FooterLink href="https://docs.polar.sh/documentation/features/products">
                Products & Subscriptions
              </FooterLink>
              <FooterLink href="https://docs.polar.sh/documentation/features/checkouts/checkout-links">
                Checkouts
              </FooterLink>
              <FooterLink href="https://docs.polar.sh/documentation/features/customer-portal">
                Customer Portal
              </FooterLink>
            </div>
          </div>
          <div className="flex flex-col gap-y-4">
            <h3 className="text-base dark:text-white">Company</h3>
            <div className="flex flex-col gap-y-2">
              <FooterLink href="https://polar.sh/careers">Careers</FooterLink>
              <FooterLink href="https://blog.polar.sh">Blog</FooterLink>
              <FooterLink href="https://polar.sh/assets/brand/polar_brand.zip">
                Brand Assets
              </FooterLink>
              <FooterLink href="https://polar.sh/legal/terms">
                Terms of Service
              </FooterLink>
              <FooterLink href="https://polar.sh/legal/privacy">
                Privacy Policy
              </FooterLink>
            </div>
          </div>
          <div className="flex flex-col gap-y-4">
            <h3 className="text-lg dark:text-white">Community</h3>
            <div className="flex flex-col gap-y-2">
              <FooterLink href="https://discord.gg/Pnhfz3UThd">
                Join our Discord
              </FooterLink>
              <FooterLink href="https://github.com/polarsource">
                GitHub
              </FooterLink>
              <FooterLink href="https://x.com/polar_sh">X / Twitter</FooterLink>
            </div>
          </div>
          <div className="flex flex-col gap-y-4">
            <h3 className="text-base dark:text-white">Support</h3>
            <div className="flex flex-col gap-y-2">
              <FooterLink href="https://docs.polar.sh">Docs</FooterLink>
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
      className="dark:text-polar-500 dark:hover:text-polar-50 flex flex-row items-center gap-x-1 text-gray-500 transition-colors hover:text-gray-500"
      {...props}
    >
      {props.children}
    </Link>
  )
}
