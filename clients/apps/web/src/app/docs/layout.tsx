import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import {
  ApiOutlined,
  BookmarkOutlined,
  DescriptionOutlined,
} from '@mui/icons-material'
import { UserSignupType } from '@polar-sh/sdk'
import { Separator } from 'polarkit/components/ui/separator'
import { PropsWithChildren } from 'react'
import { NaviagtionItem } from './NavigationItem'

export default async function Layout({ children }: PropsWithChildren) {
  return (
    <div className="flex w-full flex-col items-center gap-y-12">
      <div className="flex h-fit w-full max-w-[100vw] flex-row justify-stretch gap-x-12 px-8 py-12 md:max-w-7xl md:px-12">
        <div className="flex w-full flex-grow flex-col gap-y-12">
          <DocumentationPageTopbar />
          <Separator />
          <div className="flex flex-row items-start">
            <div className="flex w-80 flex-col">
              <ul className="flex flex-col gap-y-2">
                <li>
                  <NaviagtionItem
                    icon={<DescriptionOutlined fontSize="inherit" />}
                    href="/docs/overview"
                  >
                    Overview
                  </NaviagtionItem>
                </li>
                <li>
                  <NaviagtionItem
                    icon={<ApiOutlined fontSize="inherit" />}
                    href="/docs/api"
                  >
                    API Reference
                  </NaviagtionItem>
                </li>
                <li>
                  <NaviagtionItem
                    icon={<BookmarkOutlined fontSize="inherit" />}
                    href="/docs/guides"
                  >
                    Guides
                  </NaviagtionItem>
                </li>
              </ul>
            </div>
            <div className="flex h-full w-full flex-col">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const DocumentationPageTopbar = () => {
  return (
    <div className="relative flex flex-row items-center justify-between bg-transparent">
      <h1 className="text-xl font-medium">Documentation</h1>
      <BrandingMenu
        className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block"
        logoClassName="dark:text-white"
        size={50}
      />
      <BrandingMenu
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:hidden"
        logoClassName="dark:text-white"
        size={50}
      />
      <div className="flex flex-row items-center gap-x-6">
        <GithubLoginButton
          text="Create with Polar"
          returnTo="/maintainer"
          userSignupType={UserSignupType.MAINTAINER}
        />
      </div>
    </div>
  )
}
