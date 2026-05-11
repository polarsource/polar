'use client'

import {
  useDeletePersonalAccessToken,
  usePersonalAccessTokens,
} from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ListGroup from '@polar-sh/ui/components/atoms/ListGroup'
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
import { useCallback } from 'react'
import { toast } from '../Toast/use-toast'

const AccessToken = (props: schemas['PersonalAccessToken']) => {
  const deleteToken = useDeletePersonalAccessToken()

  const onDelete = useCallback(async () => {
    deleteToken.mutateAsync({ id: props.id }).then(({ error }) => {
      if (error) {
        toast({
          title: 'Access Token Deletion Failed',
          description: `Error deleting access token: ${extractApiErrorMessage(error)}`,
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
                new Date(props.expires_at) < new Date() ? (
                  <span className="text-red-500 dark:text-red-400">
                    Expired on{' '}
                    <FormattedDateTime
                      datetime={props.expires_at}
                      dateStyle="long"
                    />
                  </span>
                ) : (
                  <>
                    Expires on{' '}
                    <FormattedDateTime
                      datetime={props.expires_at}
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

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="dark:bg-polar-800 dark:text-polar-500 flex flex-col gap-2 rounded-2xl bg-gray-100 p-6 text-sm text-gray-500">
        <h3 className="text-base font-medium text-black dark:text-white">
          Access tokens have moved
        </h3>
        <p>
          Personal access tokens can no longer be created. Going forward, use{' '}
          <strong className="text-gray-700 dark:text-white">
            Organization access tokens
          </strong>
          . They work the same, but are scoped to a single organization, so{' '}
          <code className="text-[13px]">organization_id</code> can be omitted in
          API calls.
        </p>
      </div>
      <ListGroup>
        {tokens.data?.items && tokens.data.items.length > 0 ? (
          tokens.data?.items.map((token) => (
            <ListGroup.Item key={token.id}>
              <AccessToken {...token} />
            </ListGroup.Item>
          ))
        ) : (
          <ListGroup.Item>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              You don&apos;t have any active Personal Access Tokens.
            </p>
          </ListGroup.Item>
        )}
      </ListGroup>
    </div>
  )
}

export default AccessTokensSettings
