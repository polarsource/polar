import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import BackerLayout from '@/components/Layout/BackerLayout'
import type { NextLayoutComponentType } from 'next'
import {
  Banner,
  CopyToClipboardInput,
  Input,
  PrimaryButton,
  ThinButton,
} from 'polarkit/components/ui'
import {
  useCreatePersonalAccessToken,
  useDeletePersonalAccessToken,
  useListPersonalAccessTokens,
} from 'polarkit/hooks'
import { ReactElement, useState } from 'react'

const Page: NextLayoutComponentType = () => {
  const tokens = useListPersonalAccessTokens()
  const createToken = useCreatePersonalAccessToken()
  const deleteToken = useDeletePersonalAccessToken()

  const [createdTokenJWT, setCreatedTokenJWT] = useState('')

  const [comment, setComment] = useState('')

  const onCreate = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const created = await createToken.mutateAsync({ comment: comment })
    setCreatedTokenJWT(created.token)
    setComment('')
  }

  return (
    <BackerLayout>
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl">Personal Access Tokens</h2>

        <p>
          Use a Personal Access Token to access the{' '}
          <a className="text-blue-500" href="https://docs.polar.sh/api">
            Polar API.
          </a>
        </p>

        <div className="flex gap-2">
          <Input
            value={comment}
            onUpdated={setComment}
            id="comment"
            name="comment"
            type="text"
            placeholder="Add a comment to your token, to remember where you're using it"
          />

          <PrimaryButton fullWidth={false} onClick={(e) => onCreate(e)}>
            <span>Create new</span>
          </PrimaryButton>
        </div>

        {createdTokenJWT && (
          <Banner color="green">
            <div className="flex w-full flex-col">
              <p>
                Here&apos;s your new token. This is the last time that
                you&apos;ll see it, keep it safe!
              </p>

              <CopyToClipboardInput id="pat-copy" value={createdTokenJWT} />
            </div>
          </Banner>
        )}

        {tokens.data?.items && tokens.data.items.length > 0 && (
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Comment</th>
                <th className="pre-nowrap text-left">Last used at</th>
                <th className="pre-nowrap text-left">Expires at</th>
                <th>&nbsp;</th>
              </tr>
            </thead>

            <tbody>
              {tokens.data?.items?.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.comment ? (
                      t.comment
                    ) : (
                      <span className="text-gray-400">No comment</span>
                    )}
                  </td>
                  <td className="pre-nowrap">
                    {t.last_used_at ? (
                      new Date(t.last_used_at).toLocaleDateString()
                    ) : (
                      <span className="text-gray-400">Never used</span>
                    )}
                  </td>
                  <td className="pre-nowrap">
                    {new Date(t.expires_at).toLocaleDateString()}
                  </td>
                  <td>
                    <ThinButton
                      color="red"
                      onClick={async () => {
                        await deleteToken.mutateAsync({ id: t.id })
                      }}
                    >
                      <span>Delete</span>
                    </ThinButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </BackerLayout>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
