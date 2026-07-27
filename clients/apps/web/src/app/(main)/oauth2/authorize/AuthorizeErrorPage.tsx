'use client'

import { Alert } from '@polar-sh/orbit'
import { useRouter } from 'next/navigation'
import SharedLayout from './components/SharedLayout'

const AuthorizeErrorPage = ({
  error,
  error_description,
  error_uri,
}: {
  error: string
  error_description?: string
  error_uri?: string
}) => {
  const router = useRouter()

  return (
    <SharedLayout>
      <Alert
        variant="danger"
        title="An error occurred"
        description={error_description ?? error}
        actions={
          error_uri
            ? [
                {
                  text: 'Read more',
                  onClick: () => {
                    router.push(error_uri)
                  },
                },
              ]
            : undefined
        }
      />
    </SharedLayout>
  )
}

export default AuthorizeErrorPage
