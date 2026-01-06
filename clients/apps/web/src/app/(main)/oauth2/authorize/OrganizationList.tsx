'use client'

import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const OrganizationList = ({
  organizations,
  searchParams,
}: {
  organizations: schemas['AuthorizeOrganization'][]
  searchParams: Record<string, string>
}) => {
  const router = useRouter()
  const [loadingOrgId, setLoadingOrgId] = useState<string | null>(null)

  const buildOrganizationSelectionURL = (
    organization: schemas['AuthorizeOrganization'],
  ) => {
    const updatedSearchParams = {
      ...searchParams,
      sub: organization.id,
    }
    const serializedSearchParams = new URLSearchParams(
      updatedSearchParams,
    ).toString()
    return `?${serializedSearchParams}`
  }

  const handleOrgClick = (organization: schemas['AuthorizeOrganization']) => {
    setLoadingOrgId(organization.id)
    router.push(buildOrganizationSelectionURL(organization))
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {organizations.map((organization) => (
        <button
          key={organization.id}
          type="button"
          onClick={() => handleOrgClick(organization)}
          disabled={loadingOrgId !== null}
          className="dark:bg-polar-700 dark:hover:bg-polar-600 flex w-full flex-row items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-3 text-left text-sm transition-colors hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/5 dark:hover:border-white/5"
        >
          {loadingOrgId === organization.id ? (
            <LoadingSpinner className="h-8 w-8" />
          ) : (
            <Avatar
              className="h-8 w-8"
              avatar_url={organization.avatar_url}
              name={organization.slug}
            />
          )}
          {organization.slug}
        </button>
      ))}
    </div>
  )
}

const LoadingSpinner = ({ className }: { className?: string }) => (
  <div className={className}>
    <svg
      className="h-full w-full animate-spin text-blue-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  </div>
)

export default OrganizationList
