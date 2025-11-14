'use client'

import { Toaster } from '@/components/Toast/Toaster'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { getThemePreset, ThemePreset } from '@polar-sh/ui/hooks/theming'
import { useSearchParams } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { Navigation } from './Navigation'

export const PortalContent = ({
  organization,
  children,
}: {
  organization: schemas['CustomerOrganization']
  children: React.ReactNode
}) => {
  const searchParams = useSearchParams()

  // Get theme from query parameter, fallback to organization slug-based theme
  const themeParam = searchParams.get('theme')
  const themePresetName: ThemePreset | (string & {}) =
    themeParam || organization.slug
  const themePreset = getThemePreset(themePresetName)

  return (
    <div
      className={twMerge(
        'flex min-h-screen grow flex-col',
        themePreset.polar.customerPortalWrapper,
      )}
    >
      <div
        className={twMerge(
          'flex w-full flex-col',
          themePreset.polar.customerPortalHeader,
        )}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col justify-center gap-y-12 px-4 py-12 lg:px-0">
          <div className="flex flex-row items-center gap-x-4">
            <Avatar
              className="h-10 w-10"
              avatar_url={organization.avatar_url}
              name={organization.name}
            />
            <h3 className="text-lg">{organization.name}</h3>
          </div>
          <div>
            <h2 className="text-4xl">Customer Portal</h2>
          </div>
        </div>
      </div>
      <div className="flex w-full flex-col items-stretch gap-6 px-4 py-8 md:mx-auto md:max-w-5xl md:flex-row md:gap-12 lg:px-0">
        <Navigation organization={organization} themePreset={themePreset} />
        <div className="flex w-full flex-col md:py-12">{children}</div>
      </div>
      <Toaster />
    </div>
  )
}
