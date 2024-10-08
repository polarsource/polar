'use client'

import { useExternalOrganizations } from '@/hooks/queries/externalOrganizations'
import { LanguageOutlined, MailOutline } from '@mui/icons-material'
import { Organization, Platforms } from '@polar-sh/sdk'
import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { PropsWithChildren, useEffect, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import GitHubIcon from '../Icons/GitHubIcon'
import { externalURL } from '../Organization'
import { Gradient } from './GradientMesh'
import { computeComplementaryColor } from './utils'

interface StorefrontHeaderProps {
  organization: Organization
}

export const StorefrontHeader = ({ organization }: StorefrontHeaderProps) => {
  const segment = useSelectedLayoutSegment()

  const externalGitHubOrganizations = useExternalOrganizations({
    organizationId: organization.id,
    platform: Platforms.GITHUB,
    limit: 1,
    sorting: ['created_at'],
  })

  const isPostView = segment === 'posts'

  const gradient = useMemo(
    () => (typeof window !== 'undefined' ? new Gradient() : undefined),
    [],
  )

  useEffect(() => {
    if (!gradient) {
      return
    }

    const root = document.documentElement

    const [a, b, c, d] = computeComplementaryColor(
      organization.profile_settings?.accent_color ?? '#121316',
    )

    root.style.setProperty('--gradient-color-1', `#${a.toHex()}`)
    root.style.setProperty('--gradient-color-2', `#${b.toHex()}`)
    root.style.setProperty('--gradient-color-3', `#${c.toHex()}`)
    root.style.setProperty('--gradient-color-4', `#${d.toHex()}`)

    /* @ts-ignore */
    gradient.initGradient('#gradient-canvas')
  }, [gradient, organization])

  return (
    <div className="flex w-full flex-grow flex-col items-center gap-y-6">
      <div className="md:rounded-4xl relative aspect-[3/1] w-full rounded-2xl bg-gray-100 md:aspect-[4/1] dark:bg-black">
        <canvas
          id="gradient-canvas"
          className="md:rounded-4xl absolute bottom-0 left-0 right-0 top-0 h-full w-full rounded-2xl"
        />
        <Avatar
          className="dark:border-polar-950 absolute -bottom-16 left-1/2 h-32 w-32 -translate-x-1/2 border-8 border-gray-50 text-lg md:text-5xl"
          name={organization.name}
          avatar_url={organization.avatar_url}
        />
      </div>
      <div className="mt-16 flex flex-grow flex-col items-center">
        <div className="flex flex-col items-center md:gap-y-1">
          <h1 className="text-xl md:text-3xl">{organization.name}</h1>
          <Link
            className="dark:text-polar-500 text-gray-500"
            href={`/${organization.slug}`}
            tabIndex={-1}
          >
            @{organization.slug}
          </Link>
        </div>
      </div>
      <div
        className={twMerge(
          'flex w-full flex-grow flex-col items-center',
          isPostView ? 'hidden  md:flex' : 'flex',
        )}
      >
        <div className="flex w-full flex-grow flex-col items-center gap-y-6">
          <p
            className={twMerge(
              'dark:text-polar-500 flex w-full flex-col items-center text-center text-lg leading-normal text-gray-500 md:w-2/3',
            )}
          >
            {organization.profile_settings?.description ??
              organization.bio ??
              ''}
          </p>

          <div className="flex flex-row flex-wrap items-center gap-3 text-lg">
            {externalGitHubOrganizations.data?.items.map(
              (externalOrganization) => (
                <SocialLink
                  key={externalOrganization.id}
                  href={`https://github.com/${externalOrganization.name}`}
                >
                  <GitHubIcon width={20} height={20} />
                </SocialLink>
              ),
            )}
            {organization.twitter_username && (
              <SocialLink
                href={`https://twitter.com/${organization.twitter_username}`}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 300 300.251"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M178.57 127.15 290.27 0h-26.46l-97.03 110.38L89.34 0H0l117.13 166.93L0 300.25h26.46l102.4-116.59 81.8 116.59h89.34M36.01 19.54H76.66l187.13 262.13h-40.66"
                    fill="currentColor"
                  />
                </svg>
              </SocialLink>
            )}
            {organization.blog && (
              <SocialLink href={externalURL(organization.blog)}>
                <LanguageOutlined fontSize="small" />
              </SocialLink>
            )}
            {organization.email && (
              <SocialLink href={`mailto:${organization.email}`}>
                <MailOutline fontSize="small" />
              </SocialLink>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const SocialLink = (props: PropsWithChildren<{ href: string }>) => {
  return (
    <Link
      target="_blank"
      rel="noopener nofollow"
      className="dark:text-polar-400 flex flex-col items-center justify-center rounded-full bg-transparent text-gray-500 transition-colors hover:bg-transparent hover:text-blue-500 dark:bg-transparent dark:hover:text-white"
      href={props.href}
    >
      {props.children}
    </Link>
  )
}
