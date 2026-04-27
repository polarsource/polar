'use client'

import { usePostHog } from '@/hooks/posthog'
import { CONFIG } from '@/utils/config'
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ComponentProps, FormEvent, useCallback, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { AuthModal } from './AuthModal'

interface GetStartedButtonProps extends ComponentProps<typeof Button> {
  text?: string
  orgSlug?: string
}

const GetStartedButton = ({
  text: _text,
  wrapperClassNames,
  orgSlug: slug,
  size = 'lg',
  ...props
}: GetStartedButtonProps) => {
  const posthog = usePostHog()
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()
  const [view, setView] = useState<'choose' | 'signup' | 'login'>('choose')
  const text = _text || 'Get Started'

  const onClick = useCallback(() => {
    posthog.capture('global:user:signup:click')
    setView('choose')
    showModal()
  }, [posthog, showModal])

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onClick()
    },
    [onClick],
  )

  const handleSandbox = () => {
    posthog.capture(
      'dashboard:onboarding:mode:click',
      { mode: 'sandbox', source: 'landing_modal' },
      { send_instantly: true },
    )
    window.location.href = `${CONFIG.SANDBOX_FRONTEND_BASE_URL}/login?return_to=/onboarding/start&from=onboarding`
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
    signup: 'Sign up',
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
    signup: (
      <AuthModal
        returnTo="/onboarding/personal"
        returnParams={slug ? { slug, auto: 'true' } : {}}
        signup={{ intent: 'creator' }}
      />
    ),
    login: <AuthModal returnTo="/dashboard" />,
  }
  const modalContent = modalContents[view]

  return (
    <>
      <Button
        wrapperClassNames={twMerge(
          'flex flex-row items-center gap-x-2 ',
          wrapperClassNames,
        )}
        size={size}
        onClick={onClick}
        onSubmit={onSubmit}
        {...props}
      >
        <div>{text}</div>
        <KeyboardArrowRight
          className={size === 'lg' ? 'text-lg' : 'text-md'}
          fontSize="inherit"
        />
      </Button>

      <Modal
        title={modalTitle}
        isShown={isModalShown}
        hide={hideModal}
        modalContent={modalContent}
        className="lg:w-full lg:max-w-[480px]"
      />
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
          The billing platform built for AI companies.
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
