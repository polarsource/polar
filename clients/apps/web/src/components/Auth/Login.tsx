import { LogoType70 } from 'polarkit/components/brand'
import { ShadowBox } from 'polarkit/components/ui'
import GithubLoginButton from '../Shared/GithubLoginButton'

const Login = () => {
  return (
    <div className="flex h-screen w-full grow items-center justify-center bg-[#FEFDF9]">
      <div id="polar-bg-gradient"></div>
      <div className="flex flex-col items-center">
        <ShadowBox>
          <div className="flex flex-col items-center space-y-12 px-12 py-4">
            <LogoType70 />
            <GithubLoginButton size="large" />
          </div>
        </ShadowBox>
      </div>
    </div>
  )
}

export default Login
