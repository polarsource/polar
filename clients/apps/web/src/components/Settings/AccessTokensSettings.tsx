'use client'

import {
  useCreatePersonalAccessToken,
  useDeletePersonalAccessToken,
  usePersonalAccessTokens,
} from '@/hooks/queries'
import {
  AvailableScope,
  PersonalAccessToken,
  PersonalAccessTokenCreate,
  PersonalAccessTokenCreateResponse,
} from '@polar-sh/sdk'
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
} from 'polarkit/components/ui/alert-dialog'
import {
  FormattedDateTime,
  ShadowListGroup,
} from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import CopyToClipboardInput from 'polarkit/components/ui/atoms/copytoclipboardinput'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from 'polarkit/components/ui/form'
import { Banner } from 'polarkit/components/ui/molecules'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'polarkit/components/ui/popover'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

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
              Expires on{' '}
              <FormattedDateTime datetime={props.expires_at} dateStyle="long" />{' '}
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
                  <span
                    onClick={async () => {
                      await deleteToken.mutateAsync({ id: props.id })
                    }}
                  >
                    Delete Personal Access Token
                  </span>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {props.createdTokenJWT && (
        <>
          <CopyToClipboardInput value={props.createdTokenJWT} />
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
  const createToken = useCreatePersonalAccessToken()
  const [createdToken, setCreatedToken] =
    useState<PersonalAccessTokenCreateResponse>()

  const form = useForm<PersonalAccessTokenCreate>({
    defaultValues: { scopes: [] },
  })
  const { control, handleSubmit, reset } = form
  const [allSelected, setSelectAll] = useState(false)

  const onCreate = useCallback(
    async (data: PersonalAccessTokenCreate) => {
      const created = await createToken.mutateAsync(data)
      setCreatedToken(created)
      reset({ scopes: [] })
      createToken.reset()
    },
    [createToken, reset],
  )

  const onToggleAll = () => {
    let values: Array<AvailableScope> = []
    if (!allSelected) {
      values = Object.values(AvailableScope)
    }
    form.setValue('scopes', values)
    setSelectAll(!allSelected)
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
          <Form {...form}>
            <form
              onSubmit={handleSubmit(onCreate)}
              className="flex flex-row items-center gap-x-4"
            >
              <FormField
                control={control}
                name="comment"
                rules={{
                  required: 'This field is required',
                }}
                render={({ field }) => (
                  <FormControl>
                    <Input {...field} placeholder="Token name" />
                  </FormControl>
                )}
              />
              <FormField
                control={control}
                name="scopes"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild className="w-1/4">
                      <Button variant="outline">
                        {field.value.length === 0
                          ? 'Select scopes'
                          : field.value.length === 1
                            ? `${field.value[0]}`
                            : `${field.value.length} scopes`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="flex max-h-96 w-80 flex-col gap-2 overflow-y-auto">
                      {Object.values(AvailableScope).map((scope) => (
                        <FormField
                          key={scope}
                          control={control}
                          name="scopes"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={scope}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(scope)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([
                                            ...field.value,
                                            scope,
                                          ])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== scope,
                                            ),
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {scope}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                      <Button
                        className="mt-4"
                        onClick={onToggleAll}
                        variant={!allSelected ? 'default' : 'destructive'}
                        size="sm"
                      >
                        {!allSelected ? 'Select All' : 'Unselect All'}
                      </Button>
                    </PopoverContent>
                  </Popover>
                )}
              />
              <FormField
                control={control}
                name="expires_in"
                rules={{ required: 'This field is required' }}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="w-1/4">
                      <SelectValue placeholder="Expiration" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 7, 30, 90, 180, 365].map((days) => (
                        <SelectItem key={days} value={`P${days}D`}>
                          {days} days
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Button type="submit">Create</Button>
            </form>
          </Form>
        </ShadowListGroup.Item>
      </ShadowListGroup>
    </div>
  )
}

export default AccessTokensSettings
