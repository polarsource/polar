import Link, { LinkProps } from 'next/link'
import { PropsWithChildren } from 'react'
import { BrandingMenu } from '../Layout/Public/BrandingMenu'

const Footer = () => {
  return (
    <footer className="mt-16 flex w-full flex-col items-center gap-y-12 bg-white dark:bg-black">
      <div className="flex w-full flex-col items-center px-6 py-16 md:max-w-3xl md:px-0 xl:max-w-7xl">
        <div className="grid w-full grid-cols-1 gap-12 md:grid-cols-2 md:justify-between md:gap-24 lg:grid-cols-6">
          <div className="flex flex-1 flex-col gap-y-6 md:col-span-2">
            <span className="text-black md:ml-0 dark:text-white">
              <BrandingMenu
                className="ml-2 md:ml-0"
                logoVariant="logotype"
                size={120}
              />
            </span>
            <span className="dark:text-polar-500 w-full flex-grow text-gray-500">
              &copy; Polar Software Inc. {new Date().getFullYear()}
            </span>
          </div>

          <div className="flex flex-col gap-y-4">
            <h3 className="text-base dark:text-white">Platform</h3>
            <div className="flex flex-col gap-y-2">
              <FooterLink href="/login">Get Started</FooterLink>
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
              <FooterLink href="https://polar.sh/vision">Vision</FooterLink>
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
    </footer>
  )
}

export default Footer

const FooterLink = (props: PropsWithChildren<LinkProps>) => {
  return (
    <Link
      className="dark:text-polar-500 dark:hover:text-polar-50 flex flex-row items-center gap-x-1 rounded-2xl text-gray-500 outline-none transition-colors hover:text-gray-500 focus:ring-[3px] focus-visible:ring-blue-100 dark:ring-offset-transparent dark:focus-visible:border-blue-600 dark:focus-visible:ring-blue-700/40"
      {...props}
    >
      {props.children}
    </Link>
  )
}
