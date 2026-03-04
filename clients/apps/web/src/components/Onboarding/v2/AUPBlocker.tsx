'use client'

export function AUPBlocker() {
  return (
    <div className="flex flex-col gap-y-3 rounded-xl border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-900/20">
      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
        Physical products and services are not supported
      </p>
      <p className="text-sm text-yellow-700 dark:text-yellow-300">
        Polar is a Merchant of Record for digital products only. Physical goods,
        human services, and marketplaces are not permitted under our{' '}
        <a
          href="https://polar.sh/docs/merchant-of-record/acceptable-use"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          Acceptable Use Policy
        </a>
        .
      </p>
    </div>
  )
}
