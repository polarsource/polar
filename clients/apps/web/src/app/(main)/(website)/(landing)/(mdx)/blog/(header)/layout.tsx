export const dynamic = 'force-static'
export const dynamicParams = false

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Main Content */}
      <main>
        <div className="mx-auto flex w-full max-w-6xl flex-col px-2 md:px-0">
          {/* Content Card */}
          <div className="dark:md:bg-polar-900 dark:border-polar-800 flex flex-col gap-y-8 rounded-lg border-gray-200 shadow-xs md:gap-y-12 md:border md:bg-white md:p-24 md:px-16">
            <div className="flex flex-col items-center">{children}</div>
          </div>
        </div>
      </main>
    </div>
  )
}
