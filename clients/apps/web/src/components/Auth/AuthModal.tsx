import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import LogoIcon from '../Brand/LogoIcon'
import Login from './Login'

interface AuthModalProps {
  return_to?: string
  params?: Record<string, string>
  type?: 'signup' | 'login'
}

export const AuthModal = ({
  return_to,
  params,
  type = 'login',
}: AuthModalProps) => {
  const restParams = new URLSearchParams(params)
  const returnTo = return_to
    ? `${return_to || ''}?${restParams.toString()}`
    : undefined

  const title = type === 'signup' ? 'Sign Up' : 'Sign In'

  const copy =
    type === 'signup' ? (
      <p className="dark:text-polar-500 text-xl text-gray-500">
        Join thousands of developers getting paid to code on their passions
      </p>
    ) : null

  return (
    <ShadowBox className="p-12">
      <div className="flex flex-col justify-between gap-y-16">
        <LogoIcon className="text-black dark:text-white" size={60} />

        <div className="flex flex-col gap-y-4">
          <h1 className="text-3xl">{title}</h1>
          {copy}
        </div>

        <div className="flex flex-col gap-y-12">
          <Login returnTo={returnTo} />
        </div>
      </div>
    </ShadowBox>
  )
}
