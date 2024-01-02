'use client'

import {
  CreatePersonalAccessTokenResponse,
  PersonalAccessToken,
} from '@polar-sh/sdk'
import {
  Button,
  CopyToClipboardInput,
  FormattedDateTime,
  Input,
  ShadowListGroup,
} from 'polarkit/components/ui/atoms'
import { Banner } from 'polarkit/components/ui/molecules'
import {
  useCreatePersonalAccessToken,
  useDeletePersonalAccessToken,
  useListPersonalAccessTokens,
} from 'polarkit/hooks'
import { useState } from 'react'

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
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              await deleteToken.mutateAsync({ id: props.id })
            }}
          >
            <span>Revoke</span>
          </Button>
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

const AccessTokensSettings = () => {
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
              <ShadowListGroup.Item key={token.id}>
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
            <Button
              fullWidth={false}
              size="lg"
              onClick={onCreate}
              disabled={accessTokenName.length < 1}
            >
              Create
            </Button>
          </div>
        </ShadowListGroup.Item>
      </ShadowListGroup>
    </div>
  )
}

export default AccessTokensSettings
