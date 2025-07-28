export default function PricingCard({
  title,
  description,
  footer,
}: {
  title: string
  description: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="dark:border-polar-700 dark:bg-polar-900 flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-transparent">
      <div className="dark:bg-polar-900 flex flex-none flex-col gap-y-6 rounded-t-2xl bg-white p-8 md:p-10">
        <div className="flex h-full flex-col gap-y-2 md:gap-y-4">
          <h3 className="dark:text-polar-500 text-polar-700 text-pretty text-base">
            {title}
          </h3>
          {typeof description === 'string' ? (
            <p className="w-full flex-grow text-2xl text-gray-700 md:max-w-96 md:text-4xl dark:text-white">
              {description}
            </p>
          ) : (
            description
          )}
        </div>
      </div>
      {footer && (
        <div className="dark:bg-polar-700 dark:text-polar-500 flex-1 space-y-2 rounded-b-2xl bg-gray-100 px-8 py-4 text-sm/6 tabular-nums text-gray-400 md:px-10 md:py-6">
          {footer}
        </div>
      )}
    </div>
  )
}
