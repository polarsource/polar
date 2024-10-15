'use client'

import { KeyboardArrowRight } from '@mui/icons-material'
import Button from 'polarkit/components/ui/atoms/button'
import { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import { Organization } from '@polar-sh/sdk'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { AuthModal } from './AuthModal'

interface GetStartedButtonProps extends ComponentProps<typeof Button> {
  text?: string
  orgSlug?: string
  storefrontOrg?: Organization
}

const GetStartedButton: React.FC<GetStartedButtonProps> = ({
  text: _text,
  wrapperClassNames,
  orgSlug: slug,
  storefrontOrg,
  size = 'lg',
  ...props
}) => {
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()
  const text = _text || 'Get Started'

  let signup = {}
  if (storefrontOrg?.id) {
    signup = {
      from_storefront: storefrontOrg.id,
    }
  }

  return (
    <>
      <Button
        wrapperClassNames={twMerge(
          'flex flex-row items-center gap-x-2',
          wrapperClassNames,
        )}
        size={size}
        onClick={showModal}
        {...props}
      >
        <div>{text}</div>
        <KeyboardArrowRight
          className={size === 'lg' ? 'text-lg' : 'text-md'}
          fontSize="inherit"
        />
      </Button>

      <Modal
        isShown={isModalShown}
        hide={hideModal}
        modalContent={
          <AuthModal
            returnParams={slug ? { slug, auto: 'true' } : {}}
            signup={{
              intent: 'creator',
              ...signup
            }}
          />
        }
        className="lg:w-full lg:max-w-[480px]"
      />
    </>
  )
}

export default GetStartedButton
