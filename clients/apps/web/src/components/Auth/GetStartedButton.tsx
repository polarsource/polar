'use client'

import { usePostHog } from '@/hooks/posthog'
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ComponentProps, FormEvent, useCallback } from 'react'
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
  const text = _text || 'Get Started'

  const onClick = useCallback(() => {
    posthog.capture('global:user:signup:click')
    showModal()
  }, [posthog, showModal])

  // Supporting embedding the button in a form
  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onClick()
    },
    [onClick],
  )

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
        className="dark:hover:bg-polar-50 rounded-full bg-black font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black"
        {...props}
      >
        <div>{text}</div>
        <KeyboardArrowRight
          className={size === 'lg' ? 'text-lg' : 'text-md'}
          fontSize="inherit"
        />
      </Button>

      <Modal
        title="Login"
        isShown={isModalShown}
        hide={hideModal}
        modalContent={
          <AuthModal
            returnParams={slug ? { slug, auto: 'true' } : {}}
            signup={{
              intent: 'creator',
            }}
          />
        }
        className="lg:w-full lg:max-w-[480px]"
      />
    </>
  )
}

export default GetStartedButton
