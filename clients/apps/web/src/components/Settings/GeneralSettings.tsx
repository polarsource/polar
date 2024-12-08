import { ExpandMoreOutlined } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { ShadowListGroup } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { useCallback, useEffect, useRef, useState } from 'react'
import EmailUpdateForm from '../Form/EmailUpdateForm'
import Spinner from '../Shared/Spinner'
export type Theme = 'system' | 'light' | 'dark'
type emailStatusProps = 'form' | 'request' | 'verify'

interface GeneralSettingsProps {
  emailStatus?: 'verify' | null
  returnTo?: string
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ emailStatus }) => {
  const [theme, setTheme] = useState<Theme | undefined>()
  const [emailUpdateStatus, setUpdateEmailStatus] =
    useState<emailStatusProps>('form')
  const didSetTheme = useRef(false)
  const router = useRouter()

  useEffect(() => {
    emailStatus && setUpdateEmailStatus(emailStatus)
    if (emailStatus === 'verify') {
      setTimeout(() => {
        setUpdateEmailStatus('form')
        console.log('emailStatus', emailStatus)
        router.push('/settings')
        console.log('emailStatus', emailStatus)
      }, 3000)
    }
  }, [emailStatus, router])

  const onInitialLoad = () => {
    if (didSetTheme.current) {
      return
    }
    if (typeof localStorage === 'undefined') {
      return
    }

    didSetTheme.current = true
    const t = localStorage.getItem('theme')
    if (t) {
      setTheme(t as Theme)
    } else {
      setTheme('system')
    }
  }
  useEffect(onInitialLoad, [])

  const handleThemeChange = useCallback((theme: Theme) => {
    return () => {
      switch (theme) {
        case 'system':
          localStorage.removeItem('theme')

          if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }

          break
        case 'light':
          localStorage.setItem('theme', 'light')
          document.documentElement.classList.remove('dark')
          break
        case 'dark':
          localStorage.setItem('theme', 'dark')
          document.documentElement.classList.add('dark')
          break
      }

      setTheme(theme)
    }
  }, [])

  const renderContent: Record<emailStatusProps, React.ReactNode> = {
    form: (
      <EmailUpdateForm
        onEmailUpdateRequest={() => setUpdateEmailStatus('request')}
      />
    ),
    request: (
      <div className="dark:text-polar-400 text-center text-sm text-gray-500">
        A verification email sent to the entered email.
      </div>
    ),
    verify: (
      <div className="flex w-80 flex-col items-center gap-4">
        <div className="dark:text-polar-400 text-center text-sm text-gray-500">
          Your email has been updated!
        </div>
      </div>
    ),
  }

  return (
    <ShadowListGroup>
      <ShadowListGroup.Item>
        <div className="flex flex-row items-start justify-between">
          <div className="flex flex-col gap-y-1">
            <h3>Theme</h3>
            <p className="dark:text-polar-500 text-sm text-gray-400">
              Override your browser&apos;s preferred theme settings
            </p>
          </div>
          {theme === undefined ? (
            <Spinner />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="justify-between" variant="secondary">
                  <span className="capitalize">{theme}</span>
                  <ExpandMoreOutlined className="ml-2" fontSize="small" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="dark:bg-polar-800 bg-gray-50 shadow-lg"
                align="end"
              >
                <DropdownMenuItem onClick={handleThemeChange('system')}>
                  <span>System</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleThemeChange('light')}>
                  <span>Light</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleThemeChange('dark')}>
                  <span>Dark</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </ShadowListGroup.Item>
      <ShadowListGroup.Item>
        <div className="flex flex-row items-start items-center justify-between">
          <div className="flex flex-col gap-y-1">
            <h3>Update email</h3>
            <p className="dark:text-polar-500 text-sm text-gray-400">
              Update your account&apos;s current email
            </p>
          </div>
          <div>{renderContent[emailUpdateStatus]}</div>
        </div>
      </ShadowListGroup.Item>
    </ShadowListGroup>
  )
}

export default GeneralSettings
