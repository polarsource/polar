import { useAuth } from 'hooks'
import {
  GreenBanner,
  Input,
  PrimaryButton,
  RedBanner,
  ShadowBox,
} from 'polarkit/components/ui'
import { useInviteClaimCode } from 'polarkit/hooks'
import { useState } from 'react'

const InviteOnly = () => {
  const [code, setCode] = useState('')
  const [joinDisabled, setJoinDisabled] = useState(true)
  const [joinLoading, setJoinLoading] = useState(false)

  const claimCode = useInviteClaimCode()

  const onInputUpdated = (value: string) => {
    setCode(value)
    setJoinDisabled(value.length < 4)
  }

  const [showErrorBanner, setShowErrorBanner] = useState(false)
  const [showSuccessBanner, setShowSuccessBanner] = useState(false)

  const { currentUser, reloadUser } = useAuth()

  const onJoinClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    setJoinLoading(true)
    setShowErrorBanner(false)
    setShowSuccessBanner(false)

    claimCode
      .mutateAsync({ code: code })
      .then((res) => {
        if (res && res.status === true) {
          setShowSuccessBanner(true)
        } else {
          throw new Error('invalid code')
        }
      })
      .then(reloadUser)
      .then(() => {
        // TODO: Is this worth it?
        setTimeout(() => {
          window.location.pathname = '/dashboard'
        }, 1000)
      })
      .catch(() => {
        setShowErrorBanner(true)
      })
      .finally(() => {
        setJoinLoading(false)
      })
  }

  return (
    <div className="mx-auto my-11 flex max-w-2xl flex-col space-y-8">
      <h1 className="text-center text-xl font-normal text-gray-600 drop-shadow-md">
        Welcome to Polar
      </h1>

      {showErrorBanner && (
        <RedBanner>
          <>
            The code that you entered was not valid. Please double check your
            code and try again.
          </>
        </RedBanner>
      )}

      {showSuccessBanner && (
        <GreenBanner>
          <>You&apos;re in! Redirecting...</>
        </GreenBanner>
      )}

      <ShadowBox>
        <div className="flex flex-col space-y-2">
          <p className="text-gray-500">To join Polar, enter your invite code</p>
          <Input
            name="polar-code"
            id="polar-code"
            placeholder="Your invite code"
            onUpdated={onInputUpdated}
          />
          <PrimaryButton
            disabled={joinDisabled}
            loading={joinLoading}
            onClick={onJoinClick}
          >
            Join
          </PrimaryButton>
        </div>
      </ShadowBox>
    </div>
  )
}

export default InviteOnly
