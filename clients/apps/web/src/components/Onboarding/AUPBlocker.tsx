'use client'

import { Alert } from '@polar-sh/orbit'

export function AUPBlocker({ categories }: { categories: string[] }) {
  return (
    <Alert
      variant="warning"
      title={`Not supported: ${categories.join(', ')}`}
      description={
        <>
          Polar is a Merchant of Record for digital products only. Physical
          goods, human services, and marketplaces are not permitted under our{' '}
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
