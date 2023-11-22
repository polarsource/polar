import { LogoIcon, LogoType } from 'polarkit/components/brand'
import { Suspense } from 'react'
import { twMerge } from 'tailwind-merge'
import TopbarRight from './TopbarRight'

export type LogoPosition = 'center' | 'left'

const Topbar = (props: {
  isFixed?: boolean
  logo?: {
    title?: string
    position?: LogoPosition
  }
  hideProfile?: boolean
  useOrgFromURL: boolean
}) => {
  const className = twMerge(
    props.isFixed !== false ? 'fixed z-20' : 'z-10',
    'flex h-16 w-full items-center justify-between space-x-4 bg-white dark:bg-polar-950 px-4 drop-shadow dark:border-b dark:border-polar-700',
  )

  const hideProfile = props?.hideProfile

  const logoPosition: LogoPosition = props?.logo?.position || 'left'

  const logo = (
    <>
      <a
        href="/"
        className="flex-shrink-0 items-center space-x-2 font-semibold text-gray-700 md:inline-flex"
      >
        <LogoType />
      </a>
    </>
  )

  return (
    <>
      <div className={className}>
        <div className="flex items-center space-x-4 md:flex-1">
          {logoPosition === 'left' && !props.logo?.title && logo}
          {logoPosition === 'left' && props.logo?.title && (
            <>
              <LogoIcon />
              <span className="font-display text-xl">{props.logo?.title}</span>
            </>
          )}
        </div>

        {logoPosition == 'center' && !props.logo?.title && logo}
        {logoPosition == 'center' && props.logo?.title && (
          <>
            <LogoIcon />
            <span className="font-display text-xl">{props.logo?.title}</span>
          </>
        )}

        <div className="relative flex flex-shrink-0 items-center justify-end space-x-4 md:flex-1">
          {!hideProfile && (
            <Suspense>
              <TopbarRight />
            </Suspense>
          )}
        </div>
      </div>
    </>
  )
}
export default Topbar
