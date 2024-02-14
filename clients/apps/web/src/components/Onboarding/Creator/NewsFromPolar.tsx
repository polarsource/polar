import { LogoIcon } from 'polarkit/components/brand'

export const NewsFromPolar = () => {
  return (
    <div className="flex grid-cols-2 flex-col gap-6 md:grid xl:grid-cols-3">
      <div className="col-span-2 flex flex-col gap-y-4 md:gap-y-6 md:py-6 lg:col-span-1">
        <LogoIcon className="hidden h-24 w-24 text-blue-500 dark:text-blue-400 md:block" />
        <h2 className="text-2xl font-bold">New Features</h2>
        <p className="dark:text-polar-400 text-gray-600 [text-wrap:balance]">
          The latest updates & features from Polar
        </p>
      </div>
    </div>
  )
}
