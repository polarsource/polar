import React from 'react'
import {
  BreadcrumbLink,
  BreadcrumbPageParams,
  BreadcrumbSeparator,
} from '../Breadcrumb'

/**
 * Catch all page for breadcrumbs, if we didn't implement a specific page for the breadcrumb.
 *
 * Best-effort implementation to render the breadcrumb based on the path parts.
 *
 * If we want to fine-tune the breadcrumb for a specific page, we should create a page located at the right path.
 */
export default async function BreadcrumbPage({
  params,
}: {
  params: BreadcrumbPageParams & { all: string[] }
}) {
  const [_root, organization, ...rest] = params.all
  return (
    <>
      {rest.map((param, index) => (
        <React.Fragment key={param}>
          <BreadcrumbSeparator />
          <BreadcrumbLink
            href={`/dashboard/${organization}/${rest.slice(0, index + 1).join('/')}`}
          >
            <span className="capitalize">{param.split('-').join(' ')}</span>
          </BreadcrumbLink>
        </React.Fragment>
      ))}
    </>
  )
}
