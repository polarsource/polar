'use client'

import { LogoType70 } from 'polarkit/components/brand'
import GithubLoginButton from '../Shared/GithubLoginButton'
import { useLoginRedirect } from './Redirector'

const Login = ({ gotoUrl }: { gotoUrl?: string }) => {
  useLoginRedirect()

  return (
    <div className="dark:bg-gray-950 flex h-screen w-full grow items-center justify-center bg-[#FEFDF9]">
      <div id="polar-bg-gradient"></div>
      <div className="flex flex-col items-center">
        <LogoType70 className="mb-6 h-10" />
        <GithubLoginButton
          text="Continue with Github"
          size="large"
          gotoUrl={gotoUrl}
          posthogProps={{
            view: 'Login Page',
          }}
        />
      </div>
    </div>
  )
}

export default Login
