'use client'

import { InlineModal, InlineModalHeader } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import {
  useCreatePersonalAccessToken,
  useDeletePersonalAccessToken,
  usePersonalAccessTokens,
} from '@/hooks/queries'
import {
  AvailableScope,
  PersonalAccessToken,
  PersonalAccessTokenCreateResponse,
} from '@polar-sh/api'
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
import Banner from '@polar-sh/ui/components/molecules/banner'
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
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'

const AccessToken = (
  props: PersonalAccessToken & { createdTokenJWT?: string },
) => {
  const deleteToken = useDeletePersonalAccessToken()

  const onDelete = useCallback(async () => {
    deleteToken
      .mutateAsync({ id: props.id })
      .then(() => {
        toast({
          title: 'Access Token Deleted',
          description: `Access Token ${props.comment} was deleted successfully`,
        })
      })
      .catch((e) => {
        toast({
          title: 'Access Token Deletion Failed',
          description: `Error deleting access token: ${e.message}`,
        })
      })
  }, [deleteToken])

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row">
          <div className="gap-y flex flex-col">
            <h3 className="text-md">{props.comment}</h3>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              {props.expires_at ? (
                <>
                  Expires on{' '}
                  <FormattedDateTime
                    datetime={props.expires_at}
                    dateStyle="long"
                  />
                </>
              ) : (
                <span className="text-red-500 dark:text-red-400">
                  Never expires
                </span>
              )}{' '}
              —{' '}
              {props.last_used_at ? (
                <>
                  Last used on{' '}
                  <FormattedDateTime
                    datetime={props.last_used_at}
                    dateStyle="long"
                  />
                </>
              ) : (
                'Never used'
              )}
            </p>
          </div>
        </div>{' '}
        <div className="dark:text-polar-400 flex flex-row items-center gap-x-4 space-x-4 text-gray-500">
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
                  <span onClick={onDelete}>Delete Personal Access Token</span>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {props.createdTokenJWT && (
        <>
          <CopyToClipboardInput
            value={props.createdTokenJWT}
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
    </div>
  )
}

const AccessTokensSettings = () => {
  const tokens = usePersonalAccessTokens()
  const [createdToken, setCreatedToken] =
    useState<PersonalAccessTokenCreateResponse>()

  const {
    isShown: isNewPATModalShown,
    show: showNewPATModal,
    hide: hideNewPATModal,
  } = useModal()

  const onCreate = (token: PersonalAccessTokenCreateResponse) => {
    hideNewPATModal()
    setCreatedToken(token)
  }

  return (
    <div className="flex w-full flex-col">
      <ShadowListGroup>
        {tokens.data?.items && tokens.data.items.length > 0 ? (
          tokens.data?.items.map((token) => {
            const shouldRenderJWT =
              token.id === createdToken?.personal_access_token.id

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
              You don&apos;t have any active Personal Access Tokens.
            </p>
          </ShadowListGroup.Item>
        )}
        <ShadowListGroup.Item>
          <div className="flex flex-row items-center gap-x-4">
            <Button asChild onClick={showNewPATModal}>
              New Token
            </Button>
          </div>
        </ShadowListGroup.Item>
        <InlineModal
          isShown={isNewPATModalShown}
          hide={hideNewPATModal}
          modalContent={
            <CreateAccessTokenModal
              onSuccess={onCreate}
              onHide={hideNewPATModal}
            />
          }
        />
      </ShadowListGroup>
    </div>
  )
}

interface CreateAccessTokenModalProps {
  onSuccess: (token: PersonalAccessTokenCreateResponse) => void
  onHide: () => void
}

interface CreateTokenForm {
  comment: string
  expires_in: string | null | 'no-expiration'
  scopes: Array<AvailableScope>
}

const CreateAccessTokenModal = ({
  onSuccess,
  onHide,
}: CreateAccessTokenModalProps) => {
  const createToken = useCreatePersonalAccessToken()
  const form = useForm<CreateTokenForm>({
    defaultValues: {
      comment: '',
      expires_in: 'P30D',
      scopes: [],
    },
  })
  const { control, handleSubmit, reset } = form
  const [allSelected, setSelectAll] = useState(false)

  const onCreate = useCallback(
    async (data: CreateTokenForm) => {
      const created = await createToken.mutateAsync({
        comment: data.comment ? data.comment : '',
        expires_in:
          data.expires_in === 'no-expiration' ? null : data.expires_in,
        scopes: data.scopes,
      })
      onSuccess(created)
      reset({ scopes: [] })
      createToken.reset()
    },
    [createToken, onSuccess, reset],
  )

  const selectableScopes = Object.values(AvailableScope)

  const onToggleAll = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()

    let values: Array<AvailableScope> = []
    if (!allSelected) {
      values = selectableScopes
    }
    form.setValue('scopes', values)
    setSelectAll(!allSelected)
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      <InlineModalHeader hide={onHide}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Create Personal Access Token</h2>
        </div>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-8 p-8">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onCreate)}
            className="max-w-[700px] space-y-8"
          >
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
                    control={form.control}
                    name="scopes"
                    render={({ field }) => {
                      return (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(scope)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([
                                    ...(field.value || []),
                                    scope,
                                  ])
                                } else {
                                  field.onChange(
                                    (field.value || []).filter(
                                      (v) => v !== scope,
                                    ),
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
            <Button type="submit">Create</Button>
          </form>
        </Form>
      </div>
    </div>
  )
}

export default AccessTokensSettings
