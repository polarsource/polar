'use client'

import {
  CreatePersonalAccessTokenResponse,
  PersonalAccessToken,
} from '@polar-sh/sdk'
import {
  CopyToClipboardInput,
  FormattedDateTime,
  Input,
  PrimaryButton,
  ShadowListGroup,
  ThinButton,
} from 'polarkit/components/ui/atoms'
import { Banner } from 'polarkit/components/ui/molecules'
import {
  useCreatePersonalAccessToken,
  useDeletePersonalAccessToken,
  useListPersonalAccessTokens,
  useUser,
  useUserPreferencesMutation,
} from 'polarkit/hooks'
import { useEffect, useState } from 'react'

export type Settings = {
  email_newsletters_and_changelogs?: boolean
  email_promotions_and_events?: boolean
}

const AccessTokensSettings = () => {
  const user = useUser()
  const mutation = useUserPreferencesMutation()
  const [settings, setSettings] = useState<Settings>({})

  useEffect(() => {
    if (!user.data) {
      return
    }

    setSettings({
      email_newsletters_and_changelogs:
        user.data?.email_newsletters_and_changelogs,
      email_promotions_and_events: user.data?.email_promotions_and_events,
    })
  }, [user.data])

  const [canSave, setCanSave] = useState(false)

  const onUpdated = (next: Settings) => {
    setSettings({
      ...settings,
      ...next,
    })
    setCanSave(true)
  }

  const save = async (event: React.MouseEvent<HTMLButtonElement>) => {
    await mutation.mutateAsync({ userUpdateSettings: settings })
  }

  if (!user.data) {
    return <></>
  }

  return (
    <AccessTokensBox
      settings={settings}
      canSave={canSave}
      onUpdated={onUpdated}
      isSaving={mutation.isPending}
      save={save}
    />
  )
}

export default AccessTokensSettings

const AccessToken = (
  props: PersonalAccessToken & { createdTokenJWT?: string },
) => {
  const deleteToken = useDeletePersonalAccessToken()

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row">
          <div className="gap-y flex flex-col">
            <h3 className="text-md">{props.comment}</h3>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              <FormattedDateTime datetime={props.created_at} dateStyle="long" />
            </p>
          </div>
        </div>{' '}
        <div className="dark:text-polar-400 flex flex-row items-center gap-x-4 space-x-4 text-gray-500">
          {props.last_used_at && (
            <FormattedDateTime datetime={props.last_used_at} dateStyle="long" />
          )}
          <ThinButton
            color="red"
            onClick={async () => {
              await deleteToken.mutateAsync({ id: props.id })
            }}
          >
            <span>Revoke</span>
          </ThinButton>
        </div>
      </div>
      {props.createdTokenJWT && (
        <>
          <CopyToClipboardInput
            id="access-token-jwt"
            value={props.createdTokenJWT}
          />
          <Banner color="blue">
            <span className="text-sm">
              Copy the access token and save it somewhere safe. You won’t be
              able to see it again.
            </span>
          </Banner>
        </>
      )}
    </div>
  )
}

export const AccessTokensBox = (props: {
  settings: Settings
  onUpdated: (value: Settings) => void
  save: (event: React.MouseEvent<HTMLButtonElement>) => void
  canSave: boolean
  isSaving: boolean
}) => {
  const tokens = useListPersonalAccessTokens()
  const createToken = useCreatePersonalAccessToken()
  const [createdToken, setCreatedToken] =
    useState<CreatePersonalAccessTokenResponse>()

  const [accessTokenName, setAccessTokenName] = useState('')

  const onCreate = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const created = await createToken.mutateAsync({ comment: accessTokenName })
    setCreatedToken(created)
    setAccessTokenName('')
  }

  return (
    <div className="flex w-full flex-col">
      <ShadowListGroup>
        {tokens.data?.items && tokens.data.items.length > 0 ? (
          tokens.data?.items?.map((token) => {
            const shouldRenderJWT = token.id === createdToken?.id

            return (
              <ShadowListGroup.Item>
                <AccessToken
                  {...token}
                  createdTokenJWT={
                    shouldRenderJWT ? createdToken?.token : undefined
                  }
                />
              </ShadowListGroup.Item>
            )
          })
        ) : (
          <ShadowListGroup.Item>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              You don&apos;t have any active Access Tokens.
            </p>
          </ShadowListGroup.Item>
        )}
        <ShadowListGroup.Item>
          <div className="flex flex-row items-center gap-x-4">
            <Input
              value={accessTokenName}
              onChange={(e) => setAccessTokenName(e.target.value)}
              id="access-token-nname"
              name="name"
              placeholder="Name your Access Token"
            />
            <PrimaryButton
              fullWidth={false}
              onClick={onCreate}
              disabled={accessTokenName.length < 1}
            >
              New Access Token
            </PrimaryButton>
          </div>
        </ShadowListGroup.Item>
      </ShadowListGroup>
    </div>
  )
}
