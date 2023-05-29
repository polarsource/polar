import { LogoIcon } from 'polarkit/components/brand'
import GithubLoginButton from '../Shared/GithubLoginButton'

const Login = ({ gotoUrl }: { gotoUrl?: string }) => {
  return (
    <div className="flex h-screen w-full grow items-center justify-center bg-[#FEFDF9]">
      <div id="polar-bg-gradient"></div>
      <div className="flex flex-col items-center">
        <LogoIcon size={48} className="text-blue-800" />
        <h1 className="mb-8 mt-1 text-2xl font-medium">Log in to Polar</h1>
        <GithubLoginButton size="large" gotoUrl={gotoUrl} />
        <a
          href="https://polar.sh/request"
          className="mt-8 text-sm text-gray-500"
        >
          Request access
        </a>
      </div>
    </div>
  )
}

export default Login
