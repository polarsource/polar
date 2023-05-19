import { useAuth } from '@/hooks'
import Link from 'next/link'
import {
  Checkbox,
  PrimaryButton,
  RedBanner,
  ShadowBox,
} from 'polarkit/components/ui'
import { useUserAcceptTermsOfService } from 'polarkit/hooks'
import { ChangeEvent, useState } from 'react'
import TakeoverBox from './TakeoverBox'
import TakeoverHeader from './TakeoverHeader'

const AcceptTerms = () => {
  const [loading, setLoading] = useState(false)
  const acceptTerms = useUserAcceptTermsOfService()
  const [showErrorBanner, setShowErrorBanner] = useState(false)
  const [boxFadeOut, setBoxFadeOut] = useState(false)

  const { reloadUser } = useAuth()

  const onContinueClick = async (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    setLoading(true)
    setShowErrorBanner(false)

    acceptTerms
      .mutateAsync()
      .then((res) => {
        if (!res || !res.accepted_terms_of_service) {
          throw new Error('something went wrong')
        }
      })
      .then(await new Promise((r) => setTimeout(r, 500)))
      .then(() => {
        setLoading(false)
        setBoxFadeOut(true)
      })
      .then(await new Promise((r) => setTimeout(r, 500)))
      .then(reloadUser)
      .catch(() => {
        setShowErrorBanner(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const onChangeAcceptTos = (e: ChangeEvent<HTMLInputElement>) => {
    setAcceptedTerms(e.target.checked)
  }

  return (
    <AcceptTermsBox
      fadeOutTakeover={boxFadeOut}
      showErrorBanner={showErrorBanner}
      acceptedTerms={acceptedTerms}
      onChangeAcceptedTerms={() => {}}
      loading={loading}
      onContinueClick={onContinueClick}
    />
  )
}

export default AcceptTerms

export const AcceptTermsBox = (props: {
  fadeOutTakeover: boolean
  showErrorBanner: boolean
  acceptedTerms: boolean
  onChangeAcceptedTerms: (e: React.ChangeEvent<HTMLInputElement>) => void
  loading: boolean
  onContinueClick: (e: React.MouseEvent<HTMLButtonElement>) => void
}) => {
  return (
    <TakeoverBox fadeOut={props.fadeOutTakeover}>
      <>
        <TakeoverHeader>
          <>Terms of Service and Privacy Policy</>
        </TakeoverHeader>

        {props.showErrorBanner && (
          <RedBanner>
            <>Something went wrong, please try again.</>
          </RedBanner>
        )}

        <ShadowBox>
          <div className="flex flex-col space-y-2">
            <p className="text-gray-500">
              To join Polar you must accept the Terms of Service and the Privacy
              Policy
            </p>
            <Checkbox
              id="accept_tos"
              value={props.acceptedTerms}
              onChange={props.onChangeAcceptedTerms}
            >
              I accept the{' '}
              <Link href="https://polar.sh/legal/terms" className="underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="https://polar.sh/legal/privacy" className="underline">
                Privacy Policy
              </Link>
            </Checkbox>

            <PrimaryButton
              disabled={!props.acceptedTerms}
              loading={props.loading}
              onClick={props.onContinueClick}
            >
              Continue
            </PrimaryButton>
          </div>
        </ShadowBox>
      </>
    </TakeoverBox>
  )
}
