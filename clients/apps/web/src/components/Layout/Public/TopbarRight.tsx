'use client'

import { AuthModal } from '@/components/Auth/AuthModal'
import GetStartedButton from '@/components/Auth/GetStartedButton'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import PublicProfileDropdown from '@/components/Navigation/PublicProfileDropdown'
import Popover from '@/components/Notifications/NotificationsPopover'
import { usePostHog } from '@/hooks/posthog'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { usePathname } from 'next/navigation'

const TopbarRight = ({
  authenticatedUser,
  storefrontOrg,
}: {
  authenticatedUser?: schemas['UserRead']
  storefrontOrg?: schemas['Organization']
}) => {
  const posthog = usePostHog()
  const pathname = usePathname()
  const loginReturnTo = pathname ?? '/start'
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()

  const onLoginClick = () => {
    posthog.capture('global:user:login:click')
    showModal()
  }

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
          <Button onClick={onLoginClick} variant="secondary">
            Log in
          </Button>

          <GetStartedButton
            className="hidden md:flex"
            size="default"
            text="Sell with Polar"
            storefrontOrg={storefrontOrg}
          />

          <Modal
            isShown={isModalShown}
            hide={hideModal}
            modalContent={<AuthModal returnTo={loginReturnTo} />}
            className="lg:w-full lg:max-w-[480px]"
          />
        </>
      )}
    </>
  )
}

export default TopbarRight
