'use client'

import { Alert } from '@polar-sh/orbit'

export function StrictCategoryNotice() {
  return (
    <Alert
      variant="warning"
      title="AI image and video generation is held to a strict review"
      description={
        <>
          This is a high-risk category where we only accept established,
          legitimate businesses. To submit for review you need a support email
          on your website&rsquo;s own domain (no Gmail, Outlook or similar) and
          an API integration with webhooks. Approval also depends on business
          maturity, ownership and safeguards, and we may require additional
          information or contractual terms. Side projects and early-stage
          products will not be approved. See our{' '}
          <a
            href="https://polar.sh/legal/acceptable-use-policy"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Acceptable Use Policy
          </a>
          .
        </>
      }
    />
  )
}
