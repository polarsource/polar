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
  const [view, setView] = useState<'choose' | 'login'>('choose')
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
    setView('login')
  }

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
        title={view === 'choose' ? 'Get started' : 'Sign up'}
        isShown={isModalShown}
        hide={hideModal}
        modalContent={
          view === 'choose' ? (
            <GetStartedChoose
              onSandbox={handleSandbox}
              onGetStarted={handleGetStarted}
              onLogin={() => setView('login')}
            />
          ) : (
            <AuthModal
              returnTo="/onboarding/personal"
              returnParams={slug ? { slug, auto: 'true' } : {}}
              signup={{ intent: 'creator' }}
            />
          )
        }
        className="lg:w-full lg:max-w-[480px]"
      />
    </>
  )
}

function GetStartedChoose({
  onSandbox,
  onGetStarted,
  onLogin,
}: {
  onSandbox: () => void
  onGetStarted: () => void
  onLogin: () => void
}) {
  return (
    <div className="flex flex-col gap-y-8 p-12">
      <div className="flex flex-col gap-y-1">
        <h1 className="text-xl font-medium">Welcome to Polar</h1>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          What are you looking to do?
        </p>
      </div>

      <div className="flex flex-col gap-y-6">
        <div className="flex flex-col gap-y-2">
          <Button fullWidth onClick={onGetStarted}>
            Set up my business
          </Button>
          <p className="dark:text-polar-500 text-center text-xs text-gray-400">
            Create your organization and start accepting payments.
          </p>
        </div>
        <div className="flex flex-col gap-y-2">
          <Button fullWidth variant="secondary" onClick={onSandbox}>
            Explore sandbox
          </Button>
          <p className="dark:text-polar-500 text-center text-xs text-gray-400">
            Test data and mock payments. No setup required.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onLogin}
        className="dark:text-polar-400 dark:hover:text-polar-200 cursor-pointer text-center text-sm text-gray-500 hover:text-gray-900"
      >
        I already have an account
      </button>
    </div>
  )
}

export default GetStartedButton
