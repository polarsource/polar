'use client'

import { InlineModal, InlineModalHeader } from '@polar-sh/orbit'
import { useModal } from '@/components/Modal/useModal'
import {
  useDeleteOrganizationAccessToken,
  useOrganizationAccessTokens,
  useUpdateOrganizationAccessToken,
} from '@/hooks/queries'
import { enums, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Input } from '@polar-sh/orbit'
import { ListGroup } from '@polar-sh/orbit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import Banner from '@polar-sh/ui/components/molecules/Banner'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { type Ref, useCallback, useEffect, useRef, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { toast, useToast } from '../Toast/use-toast'
import { CreateAccessTokenModal } from './CreateAccessTokenModal'
import { TreeMultiSelect } from './TreeMultiSelect'
import { useResumeOrganizationAccessTokenCreation } from './useResumeOrganizationAccessTokenCreation'

export interface AccessTokenCreate {
  comment: string
  expires_in: string | null | 'no-expiration'
  scopes: Array<schemas['AvailableScope']>
}

interface AccessTokenUpdate {
  comment: string
  scopes: Array<schemas['AvailableScope']>
}

export const AccessTokenForm = ({ update }: { update?: boolean }) => {
  const { control } = useFormContext<AccessTokenCreate | AccessTokenUpdate>()

  return (
    <>
      <FormField
        control={control}
        name="comment"
        rules={{
          required: 'A name is required',
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input {...field} placeholder="E.g app-production" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {!update && (
        <FormField
          control={control}
          name="expires_in"
          rules={{ required: 'You need to set an expiration setting' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expiration</FormLabel>
              <FormControl>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value || ''}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select lifetime of token" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 7, 30, 90, 180, 365].map((days) => (
                      <SelectItem key={days} value={`P${days}D`}>
                        {days} day{days > 1 ? 's' : ''}
                      </SelectItem>
                    ))}
                    <SelectItem value="no-expiration">
                      <span className="text-red-500 dark:text-red-400">
                        No expiration
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      <FormField
        control={control}
        name="scopes"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <TreeMultiSelect
                title="Scopes"
                options={enums.availableScopeValues}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}

interface UpdateAccessTokenModalProps {
  token: schemas['OrganizationAccessToken']
  onSuccess: (token: schemas['OrganizationAccessToken']) => void
  onHide: () => void
}

const UpdateAccessTokenModal = ({
  token,
  onSuccess,
  onHide,
}: UpdateAccessTokenModalProps) => {
  const updateToken = useUpdateOrganizationAccessToken(token.id)
  const form = useForm<AccessTokenUpdate>({
    defaultValues: {
      ...token,
      scopes: token.scopes as schemas['AvailableScope'][],
    },
  })
  const { handleSubmit } = form
  const { toast } = useToast()

  const onUpdate = useCallback(
    async (data: AccessTokenUpdate) => {
      const { data: updated } = await updateToken.mutateAsync({
        comment: data.comment ? data.comment : '',
        scopes: data.scopes,
      })
      if (updated) {
        onSuccess(updated)
        toast({
          title: 'Access token updated',
          description: [
            'Access token',
            updated.comment ?? '',
            'was updated successfully',
          ]
            .filter(Boolean)
            .join(' '),
        })
      }
    },
    [updateToken, onSuccess, toast],
  )

  return (
    <div className="flex flex-col overflow-y-auto">
      <InlineModalHeader hide={onHide}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Update Organization Access Token</h2>
        </div>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-8 p-8">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onUpdate)}
            className="max-w-[700px] space-y-8"
          >
            <AccessTokenForm update />
            <Button type="submit">Update organization access token</Button>
          </form>
        </Form>
      </div>
    </div>
  )
}

const AccessTokenItem = ({
  token,
  rawToken,
  minimal,
  rootRef,
}: {
  token: schemas['OrganizationAccessToken']
  rawToken?: string
  minimal?: boolean
  rootRef?: Ref<HTMLDivElement>
}) => {
  const {
    isShown: updateModalShown,
    show: showUpdateModal,
    hide: hideUpdateModal,
  } = useModal()

  const {
    isShown: deleteModalShown,
    show: showDeleteModal,
    hide: hideDeleteModal,
  } = useModal()

  const deleteToken = useDeleteOrganizationAccessToken()

  const onDelete = useCallback(async () => {
    deleteToken.mutateAsync(token).then(({ error }) => {
      if (error) {
        toast({
          title: 'Could not delete access token',
          description: error.detail?.[0]?.msg ?? 'Unknown error',
        })
        return
      }
      toast({
        title: 'Access token deleted',
        description: [
          'Access token',
          token.comment ?? '',
          'was deleted successfully',
        ]
          .filter(Boolean)
          .join(' '),
      })
    })
  }, [token, deleteToken])

  return (
    <div ref={rootRef} className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2 md:flex-row md:items-center md:justify-between md:gap-x-4">
        <div className="flex min-w-0 flex-row">
          <div className="flex min-w-0 flex-col">
            <h3 className="text-md truncate">{token.comment}</h3>
            {!minimal && (
              <p className="dark:text-polar-400 text-sm text-gray-500">
                {token.expires_at ? (
                  new Date(token.expires_at) < new Date() ? (
                    <span className="text-red-500 dark:text-red-400">
                      Expired on{' '}
                      <FormattedDateTime
                        datetime={token.expires_at}
                        dateStyle="long"
                      />
                    </span>
                  ) : (
                    <>
                      Expires on{' '}
                      <FormattedDateTime
                        datetime={token.expires_at}
                        dateStyle="long"
                      />
                    </>
                  )
                ) : (
                  <span className="text-red-500 dark:text-red-400">
                    Never expires
                  </span>
                )}{' '}
                —{' '}
                {token.last_used_at ? (
                  <>
                    Last used on{' '}
                    <FormattedDateTime
                      datetime={token.last_used_at}
                      dateStyle="long"
                    />
                  </>
                ) : (
                  'Never used'
                )}
              </p>
            )}
          </div>
        </div>{' '}
        <div className="dark:text-polar-400 flex shrink-0 flex-row items-center justify-end gap-2 text-gray-500">
          <Button onClick={showUpdateModal} size="sm">
            Update
          </Button>
          <Button onClick={showDeleteModal} variant="destructive" size="sm">
            Revoke
          </Button>
        </div>
      </div>
      {rawToken && (
        <>
          <CopyToClipboardInput
            value={rawToken}
            onCopy={() => {
              toast({
                title: 'Copied to clipboard',
              })
            }}
            variant="mono"
          />
          <Banner color="blue">
            <span className="text-sm">
              Copy the access token and save it somewhere safe. You won&rsquo;t
              be able to see it again.
            </span>
          </Banner>
        </>
      )}
      <InlineModal
        isShown={updateModalShown}
        hide={hideUpdateModal}
        modalContent={
          <UpdateAccessTokenModal
            token={token}
            onSuccess={hideUpdateModal}
            onHide={hideUpdateModal}
          />
        }
      />
      <ConfirmModal
        isShown={deleteModalShown}
        hide={hideDeleteModal}
        onConfirm={onDelete}
        title="Revoke Access Token"
        description="This will permanently delete your access token."
        destructive
        destructiveText="Revoke"
        confirmPrompt={token.comment}
      />
    </div>
  )
}

interface OrganizationAccessTokensSettingsProps {
  organization: schemas['Organization']
  singleTokenMode?: boolean
  onTokenCreated?: (token: string) => void
  minimal?: boolean
}

const OrganizationAccessTokensSettings = ({
  organization,
  singleTokenMode = false,
  onTokenCreated,
  minimal = false,
}: OrganizationAccessTokensSettingsProps) => {
  const tokens = useOrganizationAccessTokens(organization.id)
  const [createdToken, setCreatedToken] =
    useState<schemas['OrganizationAccessTokenCreateResponse']>()
  const createdTokenRef = useRef<HTMLDivElement>(null)

  const {
    isShown: createModalShown,
    show: showCreateModal,
    hide: hideCreateModal,
  } = useModal()

  const onCreate = useCallback(
    (token: schemas['OrganizationAccessTokenCreateResponse']) => {
      hideCreateModal()
      setCreatedToken(token)
      onTokenCreated?.(token.token)
    },
    [hideCreateModal, onTokenCreated],
  )

  useResumeOrganizationAccessTokenCreation({
    organizationId: organization.id,
    onSuccess: onCreate,
  })

  const createdAccessToken = createdToken?.organization_access_token
  const listedTokens = tokens.data?.items ?? []
  const displayedTokens =
    createdAccessToken &&
    !listedTokens.some((token) => token.id === createdAccessToken.id)
      ? [createdAccessToken, ...listedTokens]
      : listedTokens
  const createdTokenId = createdAccessToken?.id

  useEffect(() => {
    if (!createdTokenId) return
    createdTokenRef.current?.scrollIntoView({ block: 'center' })
  }, [createdTokenId])

  const hasExistingTokens = displayedTokens.length > 0
  const showNewTokenButton = !singleTokenMode || !hasExistingTokens

  // Minimal mode: just show a button or the created token
  if (minimal) {
    return (
      <div className="flex w-full flex-col items-start gap-y-4">
        {hasExistingTokens
          ? displayedTokens.map((token) => {
              const isNewToken =
                token.id === createdToken?.organization_access_token.id
              return (
                <div
                  key={token.id}
                  className="dark:ring-polar-700 dark:bg-polar-800 w-full rounded-2xl bg-transparent p-5 ring-1 ring-gray-200"
                >
                  <AccessTokenItem
                    token={token}
                    minimal={minimal}
                    rawToken={isNewToken ? createdToken?.token : undefined}
                    rootRef={isNewToken ? createdTokenRef : undefined}
                  />
                </div>
              )
            })
          : showNewTokenButton && (
              <Button onClick={showCreateModal} size="sm">
                Create Access Token
              </Button>
            )}
        <InlineModal
          isShown={createModalShown}
          hide={hideCreateModal}
          modalContent={
            <CreateAccessTokenModal
              organization={organization}
              onSuccess={onCreate}
              onHide={hideCreateModal}
            />
          }
        />
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col">
      <ListGroup>
        {hasExistingTokens ? (
          displayedTokens.map((token) => {
            const isNewToken =
              token.id === createdToken?.organization_access_token.id

            return (
              <ListGroup.Item key={token.id}>
                <AccessTokenItem
                  token={token}
                  rawToken={isNewToken ? createdToken?.token : undefined}
                  rootRef={isNewToken ? createdTokenRef : undefined}
                />
              </ListGroup.Item>
            )
          })
        ) : (
          <ListGroup.Item>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              You don&rsquo;t have any active organization access tokens.
            </p>
          </ListGroup.Item>
        )}
        {showNewTokenButton && (
          <ListGroup.Item>
            <div className="flex flex-row items-center gap-x-4">
              <Button asChild onClick={showCreateModal} size="sm">
                Create token
              </Button>
            </div>
          </ListGroup.Item>
        )}
        <InlineModal
          isShown={createModalShown}
          hide={hideCreateModal}
          modalContent={
            <CreateAccessTokenModal
              organization={organization}
              onSuccess={onCreate}
              onHide={hideCreateModal}
            />
          }
        />
      </ListGroup>
    </div>
  )
}

export default OrganizationAccessTokensSettings
