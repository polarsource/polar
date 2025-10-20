import Login from '@/components/Auth/Login'
import LogoIcon from '@/components/Brand/LogoIcon'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getLastVisitedOrg } from '@/utils/cookies'
import { getUserOrganizations } from '@/utils/user'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page(props: {
  searchParams: Promise<{
    return_to?: string
  }>
}) {
  const searchParams = await props.searchParams

  const { return_to, ...rest } = searchParams

  const api = await getServerSideAPI()
  const userOrganizations = await getUserOrganizations(api)

  if (userOrganizations.length > 0) {
    const lastVisitedOrg = getLastVisitedOrg(await cookies(), userOrganizations)
    const organization = lastVisitedOrg ? lastVisitedOrg : userOrganizations[0]
    redirect(`/dashboard/${organization.slug}`)
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <div className="md:dark:border-polar-700 md:dark:bg-polar-900 grid w-full max-w-7xl grid-cols-1 gap-y-12 p-12 md:grid-cols-3 md:gap-x-32 md:rounded-4xl md:border md:border-gray-200 md:bg-gray-50 md:py-12 md:pr-0 md:pl-12">
        <div className="flex flex-col justify-between gap-y-24">
          <LogoIcon className="text-blue-500 dark:text-white" size={80} />

          <div className="flex flex-col gap-y-4">
            <h1 className="text-3xl">Sign Up</h1>
            <p className="dark:text-polar-500 text-xl text-gray-500">
              Join thousands of developers getting paid to code on their
              passions
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
            <Login
              returnTo={return_to}
              returnParams={rest}
              signup={{
                intent: 'creator',
              }}
            />
          </div>
        </div>
        <div className="dark:bg-polar-950 dark:border-polar-700 col-span-2 hidden overflow-hidden rounded-4xl rounded-r-none border border-r-0 border-gray-200 bg-gray-100 md:flex">
          <picture className="flex h-full">
            <source
              media="(prefers-color-scheme: dark)"
              srcSet={`/assets/landing/transactions_dark.png`}
            />
            <img
              className="flex h-full flex-1 object-cover object-left"
              src="/assets/landing/transactions_light.png"
              alt="Dashboard Home"
            />
          </picture>
        </div>
      </div>
    </div>
  )
}
