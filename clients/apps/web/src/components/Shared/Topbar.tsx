import { LogoIcon, LogoType } from 'polarkit/components/brand'
import { classNames } from 'polarkit/utils'
import { Suspense } from 'react'
import TopbarRight from './TopbarRight'

export type LogoPosition = 'center' | 'left'

const Topbar = (props: {
  isFixed?: boolean
  customLogoTitle?: string
  hideProfile?: boolean
  logoPosition?: LogoPosition
  useOrgFromURL: boolean
}) => {
  const className = classNames(
    props.isFixed !== false ? 'fixed z-20' : '',
    'flex h-16 w-full items-center justify-between space-x-4 bg-white dark:bg-gray-800 px-4 drop-shadow dark:border-b dark:border-gray-700',
  )

  const hideProfile = props?.hideProfile

  const logoPosition: LogoPosition = props?.logoPosition || 'left'

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
          {logoPosition === 'left' && !props.customLogoTitle && logo}
          {logoPosition === 'left' && props.customLogoTitle && (
            <>
              <LogoIcon />
              <span className="font-display text-xl">
                {props.customLogoTitle}
              </span>
            </>
          )}
        </div>

        {logoPosition == 'center' && !props.customLogoTitle && logo}
        {logoPosition == 'center' && props.customLogoTitle && (
          <>
            <LogoIcon />
            <span className="font-display text-xl">
              {props.customLogoTitle}
            </span>
          </>
        )}

        <div className="flex flex-shrink-0 items-center justify-end space-x-4 md:flex-1">
          {!hideProfile && (
            <Suspense>
              <TopbarRight useOrgFromURL={props.useOrgFromURL} />
            </Suspense>
          )}
        </div>
      </div>
    </>
  )
}
export default Topbar
