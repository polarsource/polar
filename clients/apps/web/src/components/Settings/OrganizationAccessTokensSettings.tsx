'use client'

import { InlineModal, InlineModalHeader } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import {
  useCreateOrganizationAccessToken,
  useDeleteOrganizationAccessToken,
  useOrganizationAccessTokens,
  useUpdateOrganizationAccessToken,
} from '@/hooks/queries'
import { enums, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import ShadowListGroup from '@polar-sh/ui/components/atoms/ShadowListGroup'
import Banner from '@polar-sh/ui/components/molecules/Banner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@polar-sh/ui/components/ui/alert-dialog'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useCallback, useState, type MouseEvent } from 'react'
import { useForm, useFormContext } from 'react-hook-form'
import { toast, useToast } from '../Toast/use-toast'

interface AccessTokenCreate {
  comment: string
  expires_in: string | null | 'no-expiration'
  scopes: Array<schemas['AvailableScope']>
}

interface AccessTokenUpdate {
  comment: string
  scopes: Array<schemas['AvailableScope']>
}

const AccessTokenForm = ({ update }: { update?: boolean }) => {
  const { control, setValue } = useFormContext<
    AccessTokenCreate | AccessTokenUpdate
  >()

  const selectableScopes =
    enums.availableScopeValues as schemas['AvailableScope'][]
  const [allSelected, setSelectAll] = useState(false)

  const onToggleAll = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()

      let values: Array<schemas['AvailableScope']> = []
      if (!allSelected) {
        values = selectableScopes
      }
      setValue('scopes', values)
      setSelectAll(!allSelected)
    },
    [setValue, allSelected, selectableScopes],
  )

  return (
    <>
      <FormField
        control={control}
        name="comment"
        rules={{
          required: 'A name is required',
        }}
        render={({ field }) => (
          <FormItem className="flex flex-col gap-4">
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Name</FormLabel>
            </div>
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
            <FormItem className="flex flex-col gap-4">
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Expiration</FormLabel>
              </div>
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
                        {days} days
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
      <div className="flex flex-col gap-6">
        <div className="flex flex-row items-center">
          <h2 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Scopes
          </h2>

          <div className="flex-auto text-right">
            <Button onClick={onToggleAll} variant="secondary" size="sm">
              {!allSelected ? 'Select All' : 'Unselect All'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {Object.values(selectableScopes).map((scope) => (
            <FormField
              key={scope}
              control={control}
              name="scopes"
              render={({ field }) => {
                return (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value?.includes(scope)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            field.onChange([...(field.value || []), scope])
                          } else {
                            field.onChange(
                              (field.value || []).filter((v) => v !== scope),
                            )
                          }
                        }}
                      />
                    </FormControl>
                    <FormLabel className="text-sm leading-none">
                      {scope}
                    </FormLabel>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
          ))}
        </div>
      </div>
    </>
  )
}

interface CreateAccessTokenModalProps {
  organization: schemas['Organization']
  onSuccess: (token: schemas['OrganizationAccessTokenCreateResponse']) => void
  onHide: () => void
}

const CreateAccessTokenModal = ({
  organization,
  onSuccess,
  onHide,
}: CreateAccessTokenModalProps) => {
  const createToken = useCreateOrganizationAccessToken(organization.id)
  const form = useForm<AccessTokenCreate>({
    defaultValues: {
      comment: '',
      expires_in: 'P30D',
      scopes: [],
    },
  })
  const { handleSubmit, reset } = form

  const onCreate = useCallback(
    async (data: AccessTokenCreate) => {
      const { data: created } = await createToken.mutateAsync({
        comment: data.comment ? data.comment : '',
        expires_in:
          data.expires_in === 'no-expiration' ? null : data.expires_in,
        scopes: data.scopes,
      })
      if (created) {
        onSuccess(created)
        reset({ scopes: [] })
        createToken.reset()
      }
    },
    [createToken, onSuccess, reset],
  )

  return (
    <div className="flex flex-col overflow-y-auto">
      <InlineModalHeader hide={onHide}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Create Organization Access Token</h2>
        </div>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-8 p-8">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onCreate)}
            className="max-w-[700px] space-y-8"
          >
            <AccessTokenForm />
            <Button type="submit">Create</Button>
          </form>
        </Form>
      </div>
    </div>
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
          title: 'Access Token Updated',
          description: `Access Token ${updated.comment} was updated successfully`,
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
            <Button type="submit">Update</Button>
          </form>
        </Form>
      </div>
    </div>
  )
}

const AccessTokenItem = ({
  token,
  rawToken,
}: {
  token: schemas['OrganizationAccessToken']
  rawToken?: string
}) => {
  const {
    isShown: updateModalShown,
    show: showUpdateModal,
    hide: hideUpdateModal,
  } = useModal()

  const deleteToken = useDeleteOrganizationAccessToken()

  const onDelete = useCallback(async () => {
    deleteToken.mutateAsync(token).then(({ error }) => {
      if (error) {
        toast({
          title: 'Access Token Deletion Failed',
          description: `Error deleting access token: ${error.detail}`,
        })
        return
      }
      toast({
        title: 'Access Token Deleted',
        description: `Access Token ${token.comment} was deleted successfully`,
      })
    })
  }, [token, deleteToken])

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row">
          <div className="gap-y flex flex-col">
            <h3 className="text-md">{token.comment}</h3>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              {token.expires_at ? (
                <>
                  Expires on{' '}
                  <FormattedDateTime
                    datetime={token.expires_at}
                    dateStyle="long"
                  />
                </>
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
          </div>
        </div>{' '}
        <div className="dark:text-polar-400 flex flex-row items-center gap-2 text-gray-500">
          <Button onClick={showUpdateModal}>Update</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Revoke</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your access token.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90 cursor-pointer text-white"
                  asChild
                >
                  <span onClick={onDelete}>
                    Delete Organization Access Token
                  </span>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {rawToken && (
        <>
          <CopyToClipboardInput
            value={rawToken}
            onCopy={() => {
              toast({
                title: 'Copied To Clipboard',
                description: `Access Token was copied to clipboard`,
              })
            }}
          />
          <Banner color="blue">
            <span className="text-sm">
              Copy the access token and save it somewhere safe. You won’t be
              able to see it again.
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
    </div>
  )
}

const OrganizationAccessTokensSettings = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const tokens = useOrganizationAccessTokens(organization.id)
  const [createdToken, setCreatedToken] =
    useState<schemas['OrganizationAccessTokenCreateResponse']>()

  const {
    isShown: createModalShown,
    show: showCreateModal,
    hide: hideCreateModal,
  } = useModal()

  const onCreate = (
    token: schemas['OrganizationAccessTokenCreateResponse'],
  ) => {
    hideCreateModal()
    setCreatedToken(token)
  }

  return (
    <div className="flex w-full flex-col">
      <ShadowListGroup>
        {tokens.data?.items && tokens.data.items.length > 0 ? (
          tokens.data?.items.map((token) => {
            const isNewToken =
              token.id === createdToken?.organization_access_token.id

            return (
              <ShadowListGroup.Item key={token.id}>
                <AccessTokenItem
                  token={token}
                  rawToken={isNewToken ? createdToken?.token : undefined}
                />
              </ShadowListGroup.Item>
            )
          })
        ) : (
          <ShadowListGroup.Item>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              You don&apos;t have any active Organization Access Tokens.
            </p>
          </ShadowListGroup.Item>
        )}
        <ShadowListGroup.Item>
          <div className="flex flex-row items-center gap-x-4">
            <Button asChild onClick={showCreateModal}>
              New Token
            </Button>
          </div>
        </ShadowListGroup.Item>
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
      </ShadowListGroup>
    </div>
  )
}

export default OrganizationAccessTokensSettings
