import { useAuth } from '@/hooks'
import {
  Input,
  PrimaryButton,
  RedBanner,
  ShadowBox,
} from 'polarkit/components/ui'
import { useInviteClaimCode } from 'polarkit/hooks'
import { useState } from 'react'
import TakeoverBox from './TakeoverBox'
import TakeoverHeader from './TakeoverHeader'

const InviteOnly = () => {
  const [code, setCode] = useState('')
  const [joinDisabled, setJoinDisabled] = useState(true)
  const [joinLoading, setJoinLoading] = useState(false)
  const [boxFadeOut, setBoxFadeOut] = useState(false)

  const claimCode = useInviteClaimCode()

  const onInputUpdated = (value: string) => {
    setCode(value)
    setJoinDisabled(value.length < 4)
  }

  const [showErrorBanner, setShowErrorBanner] = useState(false)
  const { reloadUser } = useAuth()

  const onJoinClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    setJoinLoading(true)
    setShowErrorBanner(false)

    claimCode
      .mutateAsync({ code: code })
      .then((res) => {
        if (res && res.status === true) {
          // nice!
        } else {
          throw new Error('invalid code')
        }
      })
      .then(await new Promise((r) => setTimeout(r, 500)))
      .then(() => {
        setJoinLoading(false)
        setBoxFadeOut(true)
      })
      .then(await new Promise((r) => setTimeout(r, 500)))
      .then(reloadUser)
      .catch(() => {
        setShowErrorBanner(true)
      })
      .finally(() => {
        setJoinLoading(false)
      })
  }

  return (
    <TakeoverBox fadeOut={boxFadeOut}>
      <>
        <TakeoverHeader>
          <>Welcome to Polar</>
        </TakeoverHeader>

        {showErrorBanner && (
          <RedBanner>
            <>
              The code that you entered was not valid. Please double check your
              code and try again.
            </>
          </RedBanner>
        )}
        <ShadowBox>
          <div className="flex flex-col space-y-2">
            <p className="text-gray-500">
              To join Polar, enter your invite code
            </p>
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
      </>
    </TakeoverBox>
  )
}

export default InviteOnly
