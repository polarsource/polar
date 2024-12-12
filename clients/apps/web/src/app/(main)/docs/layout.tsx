import { PropsWithChildren } from 'react'

export default async function Layout({ children }: PropsWithChildren) {
  return (
    <div className="dark:bg-polar-950 flex w-full flex-col items-center gap-y-12 bg-white">
      <div className="flex w-full flex-col gap-x-24 gap-y-16 px-4 pb-24 pt-16 md:flex-row md:items-start md:justify-between md:px-0 md:py-0">
        {children}
      </div>
    </div>
  )
}
