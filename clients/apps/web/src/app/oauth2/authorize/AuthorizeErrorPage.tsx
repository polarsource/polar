import { LogoType } from 'polarkit/components/brand'
import Alert from 'polarkit/components/ui/atoms/alert'
import Button from 'polarkit/components/ui/atoms/button'

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
    <div className="dark:bg-polar-950 flex h-screen w-full grow items-center justify-center bg-gray-50">
      <div id="polar-bg-gradient"></div>
      <div className="flex w-80 flex-col items-center gap-6">
        <LogoType className="h-10" />
        <div className="w-full">
          <Alert color="red">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="text-lg font-bold">An error occured</div>
              <div>{error_description ? error_description : error}</div>
              {error_uri && (
                <a href={error_uri}>
                  <Button variant="default">Read more</Button>
                </a>
              )}
            </div>
          </Alert>
        </div>
      </div>
    </div>
  )
}

export default AuthorizeErrorPage
