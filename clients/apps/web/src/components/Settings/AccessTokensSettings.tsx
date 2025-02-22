'use client'

import {
  useDeletePersonalAccessToken,
  useListOrganizations,
  usePersonalAccessTokens,
} from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ShadowListGroup from '@polar-sh/ui/components/atoms/ShadowListGroup'
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
import Link from 'next/link'
import { useCallback } from 'react'
import { toast } from '../Toast/use-toast'

const AccessToken = (props: schemas['PersonalAccessToken']) => {
  const deleteToken = useDeletePersonalAccessToken()

  const onDelete = useCallback(async () => {
    deleteToken.mutateAsync({ id: props.id }).then(({ error }) => {
      if (error) {
        toast({
          title: 'Access Token Deletion Failed',
          description: `Error deleting access token: ${error.detail}`,
        })
        return
      }
      toast({
        title: 'Access Token Deleted',
        description: `Access Token ${props.comment} was deleted successfully`,
      })
    })
  }, [deleteToken, props])

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
    </div>
  )
}

const AccessTokensSettings = () => {
  const tokens = usePersonalAccessTokens()
  const { data: organizations } = useListOrganizations({})
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="dark:bg-polar-800 dark:text-polar-500 flex flex-col gap-2 rounded-2xl bg-gray-100 p-6 text-sm text-gray-500">
        <h3 className="text-lg text-black dark:text-white">
          Access tokens have moved
        </h3>
        <p>
          We no longer recommend to use Personal Access Tokens, but rather{' '}
          <strong>Organization Access Tokens</strong>. They work the same, but
          only have access to one organization, which allows you to omit{' '}
          <code className="">organization_id</code> in API calls.
        </p>
        <Link
          href={`/dashboard/${organizations?.items[0].slug}/settings#developers`}
        >
          <Button variant="link" className="p-0">
            Create Organization Access Token
          </Button>
        </Link>
      </div>
      <ShadowListGroup>
        {tokens.data?.items && tokens.data.items.length > 0 ? (
          tokens.data?.items.map((token) => (
            <ShadowListGroup.Item key={token.id}>
              <AccessToken {...token} />
            </ShadowListGroup.Item>
          ))
        ) : (
          <ShadowListGroup.Item>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              You don&apos;t have any active Personal Access Tokens.
            </p>
          </ShadowListGroup.Item>
        )}
      </ShadowListGroup>
    </div>
  )
}

export default AccessTokensSettings
