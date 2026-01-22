import Alert from '@polar-sh/ui/components/atoms/Alert'
import Button from '@polar-sh/ui/components/atoms/Button'
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
  return (
    <SharedLayout>
      <Alert color="red">
        <div className="flex flex-col items-center gap-2 p-2 text-center">
          <div className="text-base font-medium">An error occured</div>
          <div className="text-sm">
            {error_description ? error_description : error}
          </div>
          {error_uri && (
            <a href={error_uri}>
              <Button variant="default">Read more</Button>
            </a>
          )}
        </div>
      </Alert>
    </SharedLayout>
  )
}

export default AuthorizeErrorPage
