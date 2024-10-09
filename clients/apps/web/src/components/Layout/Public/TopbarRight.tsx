'use client'

import { AuthModal } from '@/components/Auth/AuthModal'
import GetStartedButton from '@/components/Auth/GetStartedButton'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import PublicProfileDropdown from '@/components/Navigation/PublicProfileDropdown'
import Popover from '@/components/Notifications/Popover'
import { UserRead } from '@polar-sh/sdk'
import { usePathname } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'

const TopbarRight = ({
  authenticatedUser,
}: {
  authenticatedUser?: UserRead
}) => {
  const pathname = usePathname()
  const loginReturnTo = pathname ?? '/purchases'
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()

  return (
    <>
      {authenticatedUser ? (
        <div>
          <div className="relative flex w-max flex-shrink-0 flex-row items-center justify-between gap-x-6">
            <Popover />
            <PublicProfileDropdown
              authenticatedUser={authenticatedUser}
              className="flex-shrink-0"
            />
          </div>
        </div>
      ) : (
        <>
          <Button onClick={showModal} variant="secondary">
            Login
          </Button>
          <GetStartedButton size="default" />
          <Modal
            isShown={isModalShown}
            hide={hideModal}
            modalContent={<AuthModal type="login" return_to={loginReturnTo} />}
            className="lg:w-full lg:max-w-[480px]"
          />
        </>
      )}
    </>
  )
}

export default TopbarRight
