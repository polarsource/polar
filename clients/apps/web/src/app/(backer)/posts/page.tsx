import { Feed } from '@/components/Feed/Feed'

export default async function Page() {
  return (
    <div className="relative flex flex-row items-start gap-x-24">
      <div className="flex w-full max-w-xl flex-col gap-y-8 pb-12">
        <Feed />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-y-6 pt-6">
        <h3 className="dark:text-polar-50 text-md text-gray-950">
          Maintainers you may know
        </h3>
        <div className="dark:bg-polar-900 dark:border-polar-800 h-[160px] w-full rounded-2xl border border-gray-100 bg-white" />
      </div>
    </div>
  )
}
