import { classNames } from 'polarkit/utils'
import BackerNavigation from '../Dashboard/BackerNavigation'
import Topbar from '../Shared/Topbar'

const BackerLayout = (props: { children: React.ReactElement }) => {
  return (
    <div className="relative flex flex-col">
      <Topbar isFixed={true} />

      <div className="dark:bg-gray-950 flex flex-col bg-gray-50 pt-16">
        <nav className="fixed z-10 w-full border-b bg-gray-50 py-3 dark:bg-gray-800">
          <BackerNavigation />
        </nav>

        <main className={classNames('relative w-full')}>
          <div
            className={classNames(
              'relative mx-auto max-w-screen-2xl px-4 pt-14 pb-6 md:px-16',
            )}
          >
            {props.children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default BackerLayout
