import { LogoType70 } from 'polarkit/components/brand'
import GithubLoginButton from '../Shared/GithubLoginButton'

const Login = ({ gotoUrl }: { gotoUrl?: string }) => {
  return (
    <div className="dark:bg-gray-950 flex h-screen w-full grow items-center justify-center bg-[#FEFDF9]">
      <div id="polar-bg-gradient"></div>
      <div className="flex flex-col items-center">
        <LogoType70 className="mb-6 h-10" />
        <GithubLoginButton size="large" gotoUrl={gotoUrl} />
      </div>
    </div>
  )
}

export default Login
