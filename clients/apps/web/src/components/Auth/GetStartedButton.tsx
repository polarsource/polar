'use client'

import { usePostHog } from '@/hooks/posthog'
import { CONFIG } from '@/utils/config'
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight'
import { Button } from '@polar-sh/orbit'
import { ComponentProps, FormEvent, useCallback, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Modal } from '@polar-sh/orbit'
import { useModal } from '../Modal/useModal'
import { AuthModal } from './AuthModal'

/**
 * The sign-up flow behind every "Get started": the click is tracked, then a modal offers production or the sandbox,
 * and production goes on to sign up. Render `modal` once, next to whatever trigger calls `open`.
 */
export const useGetStarted = () => {
  const posthog = usePostHog()
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()
  const [view, setView] = useState<'choose' | 'signup' | 'login'>('choose')

  const open = useCallback(() => {
    posthog.capture('global:user:signup:click')
    setView('choose')
    showModal()
  }, [posthog, showModal])

  const handleSandbox = () => {
    posthog.capture(
      'dashboard:onboarding:mode:click',
      { mode: 'sandbox', source: 'landing_modal' },
      { send_instantly: true },
    )
    window.location.href = `${CONFIG.SANDBOX_FRONTEND_BASE_URL}/auth?return_to=/onboarding/start`
  }

  const handleGetStarted = () => {
    posthog.capture('dashboard:onboarding:mode:click', {
      mode: 'production',
      source: 'landing_modal',
    })
    setView('signup')
  }

  const modalTitles = {
    choose: 'Get started',
    signup: 'Get started',
    login: 'Sign in',
  } as const
  const modalTitle = modalTitles[view]

  const modalContents = {
    choose: (
      <GetStartedChoose
        onSandbox={handleSandbox}
        onGetStarted={handleGetStarted}
        onLogin={() => setView('login')}
      />
    ),
    signup: <AuthModal returnTo="/onboarding/personal" signup />,
    login: <AuthModal returnTo="/dashboard" />,
  }
  const modalContent = modalContents[view]

  const modal = (
    <Modal
      title={modalTitle}
      isShown={isModalShown}
      hide={hideModal}
      modalContent={modalContent}
      className="lg:w-full lg:max-w-[480px]"
    />
  )

  return { open, modal }
}

interface GetStartedButtonProps extends ComponentProps<typeof Button> {
  text?: string
}

const GetStartedButton = ({
  text: _text,
  wrapperClassNames,
  size = 'lg',
  ...props
}: GetStartedButtonProps) => {
  const { open, modal } = useGetStarted()
  const text = _text || 'Get Started'

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      e.stopPropagation()
      open()
    },
    [open],
  )

  return (
    <>
      <Button
        wrapperClassNames={twMerge(
          'flex flex-row items-center gap-x-2 ',
          wrapperClassNames,
        )}
        size={size}
        onClick={open}
        onSubmit={onSubmit}
        {...props}
      >
        <div>{text}</div>
        <KeyboardArrowRight
          className={size === 'lg' ? 'text-lg' : 'text-md'}
          fontSize="inherit"
        />
      </Button>
      {modal}
    </>
  )
}

function GetStartedChoose({
  onSandbox,
  onGetStarted,
}: {
  onSandbox: () => void
  onGetStarted: () => void
  onLogin: () => void
}) {
  return (
    <div className="flex flex-col gap-y-12 p-12">
      <div className="flex flex-col gap-y-1">
        <h1 className="text-xl font-medium">Welcome to Polar</h1>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          A billing platform for the intelligence era.
        </p>
      </div>

      <div className="flex flex-col gap-y-4">
        <div>
          <Button fullWidth onClick={onGetStarted}>
            Get started
          </Button>
          <p className="dark:text-polar-500 mt-2 text-center text-xs text-gray-400">
            Create your organization and start accepting payments.
          </p>
        </div>
        <div className="flex w-full flex-row items-center gap-6">
          <div className="dark:border-polar-700 grow border-t border-gray-200" />
          <div className="text-sm text-gray-500">or</div>
          <div className="dark:border-polar-700 grow border-t border-gray-200" />
        </div>
        <div>
          <Button fullWidth variant="secondary" onClick={onSandbox}>
            Try the sandbox
          </Button>
          <p className="dark:text-polar-500 mt-2 text-center text-xs text-gray-400">
            Test data and mock payments. No setup required.
          </p>
        </div>
      </div>
    </div>
  )
}

export default GetStartedButton
