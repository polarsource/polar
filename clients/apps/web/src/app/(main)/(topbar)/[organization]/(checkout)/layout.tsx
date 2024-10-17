import { twMerge } from 'tailwind-merge'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={twMerge(
        'mb:mt-12 mb:mb-24 mx-auto mb-16 flex w-full flex-col space-y-8 px-2 md:space-y-12 lg:px-0',
        'max-w-[970px]',
      )}
    >
      {children}
    </div>
  )
}
