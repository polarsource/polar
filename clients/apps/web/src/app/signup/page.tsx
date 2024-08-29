import Login from '@/components/Auth/Login'
import LogoIcon from '@/components/Brand/LogoIcon'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getUserOrganizations } from '@/utils/user'
import { redirect } from 'next/navigation'

export default async function Page({
  searchParams: { return_to, ...rest },
}: {
  searchParams: {
    return_to?: string
  }
}) {
  const restParams = new URLSearchParams(rest)
  const returnTo = return_to
    ? `${return_to || ''}?${restParams.toString()}`
    : undefined

  const api = getServerSideAPI()
  const userOrganizations = await getUserOrganizations(api)

  if (userOrganizations.length > 0) {
    redirect(`/dashboard/${userOrganizations[0].slug}`)
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <div className="md:rounded-4xl md:dark:border-polar-700 md:dark:bg-polar-900 grid w-full max-w-7xl grid-cols-1 gap-y-12 p-12 md:grid-cols-3 md:gap-x-32 md:border md:border-gray-100 md:bg-white md:py-12 md:pl-12 md:pr-0">
        <div className="flex flex-col justify-between gap-y-24">
          <LogoIcon className="text-blue-500 dark:text-white" size={80} />

          <div className="flex flex-col gap-y-4">
            <h1 className="text-3xl">Sign Up</h1>
            <p className="dark:text-polar-500 text-xl text-gray-500">
              Join thousands of developers monetizing their coding adventures
            </p>
          </div>

          <div className="flex flex-col gap-y-12">
            {/* <div className="flex flex-col gap-y-2">
              <label
                className="dark:text-polar-500 text-sm text-gray-500"
                htmlFor="org-name"
              >
                Organization Name
              </label>
              <Input name="org-name" autoFocus />
            </div> */}
            <Login returnTo={returnTo} />
          </div>
        </div>
        <div className="dark:bg-polar-950 dark:border-polar-700 rounded-4xl bg-gray-75 col-span-2 hidden overflow-hidden rounded-r-none border border-r-0 border-gray-100 py-2 pl-2 md:flex">
          <picture>
            <source
              media="(prefers-color-scheme: dark)"
              srcSet={`/assets/landing/overview_dark.png`}
            />
            <img
              className="h-full object-cover object-left"
              src="/assets/landing/overview.png"
              alt="Dashboard Home"
            />
          </picture>
        </div>
      </div>
    </div>
  )
}
