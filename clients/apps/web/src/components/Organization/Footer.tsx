import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import Link from 'next/link'
import { PropsWithChildren } from 'react'
import { PolarLogotype } from '../Layout/Public/PolarLogotype'

const Footer = () => {
  return (
    <div className="mt-16 flex w-full flex-col items-center gap-y-12 bg-white dark:bg-black">
      <div className="flex w-full flex-col items-center px-6 py-16 md:max-w-3xl md:px-0 lg:py-32 xl:max-w-6xl">
        <div className="grid w-full grid-cols-1 gap-12 md:grid-cols-2 md:justify-between md:gap-16 lg:grid-cols-6">
          <div className="flex h-full flex-1 flex-col justify-between gap-y-6 md:col-span-2">
            <span className="text-black md:ml-0">
              <PolarLogotype
                className="ml-2 md:ml-0"
                logoVariant="logotype"
                size={120}
              />
            </span>
            <div className="flex flex-col gap-y-6">
              <Link
                href="/signup"
                className="flex w-fit flex-row items-center gap-x-2 border-b border-black pb-0.5 dark:border-white"
              >
                <span>Join Polar today</span>
                <ArrowOutwardOutlined fontSize="inherit" />
              </Link>
              <span className="dark:text-polar-500 w-full text-gray-500">
                &copy; Polar Software, Inc. {new Date().getFullYear()}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-y-4 text-sm">
            <h3 className="dark:text-polar-500 text-gray-500">Features</h3>
            <div className="flex flex-col gap-y-3">
              <FooterLink href="/features/products">Products</FooterLink>
              <FooterLink href="/features/analytics">Usage Billing</FooterLink>
              <FooterLink href="/features/customers">Customers</FooterLink>
              <FooterLink href="/features/analytics">Analytics</FooterLink>
              <FooterLink href="/features/benefits">Benefits</FooterLink>
              <FooterLink href="/features/finance">Finance</FooterLink>
            </div>
          </div>
          <div className="flex flex-col gap-y-4 text-sm">
            <h3 className="dark:text-polar-500 text-gray-500">Resources</h3>
            <div className="flex flex-col gap-y-3">
              <FooterLink href="/resources/why">Why Polar</FooterLink>
              <FooterLink href="/resources/merchant-of-record">
                Merchant of Record
              </FooterLink>
              <FooterLink href="/resources/pricing">Pricing</FooterLink>
              <FooterLink href="/downloads">Downloads</FooterLink>
            </div>
          </div>
          <div className="flex flex-col gap-y-4 text-sm">
            <h3 className="dark:text-polar-500 text-gray-500">Company</h3>
            <div className="flex flex-col gap-y-3">
              <FooterLink href="/company">About Polar</FooterLink>
              <FooterLink href="https://github.com/polarsource">
                GitHub
              </FooterLink>
              <FooterLink href="https://x.com/polar_sh">X / Twitter</FooterLink>
              <FooterLink href="https://discord.gg/Pnhfz3UThd">
                Discord
              </FooterLink>
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
          <div className="flex flex-col gap-y-4 text-sm">
            <h3 className="dark:text-polar-500 text-gray-500">Support</h3>
            <div className="flex flex-col gap-y-3">
              <FooterLink href="https://polar.sh/docs">Docs</FooterLink>
              <FooterLink href="mailto:support@polar.sh">Contact</FooterLink>
              <FooterLink href="https://status.polar.sh">
                Service Status
              </FooterLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Footer

const FooterLinkClassnames =
  'dark:text-white dark:hover:text-polar-100 flex flex-row items-center gap-x-1 text-black transition-colors hover:text-gray-500'

const FooterLink = (props: PropsWithChildren<{ href: string }>) => {
  const isExternal = props.href.toString().startsWith('http')

  if (isExternal) {
    return (
      <a className={FooterLinkClassnames} {...props}>
        {props.children}
      </a>
    )
  }

  return (
    <Link className={FooterLinkClassnames} {...props}>
      {props.children}
    </Link>
  )
}
