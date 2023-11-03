import { ExpandMoreOutlined } from '@mui/icons-material'
import { Button, ShadowBox } from 'polarkit/components/ui/atoms'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { useUser } from 'polarkit/hooks'
import { useCallback, useMemo, useState } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const GeneralSettings = () => {
  const user = useUser()
  const [theme, setTheme] = useState<Theme>(
    (localStorage.getItem('theme') as Theme) || 'system',
  )

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

  const getCurrentThemeLabel = useMemo(() => {
    switch (theme) {
      case 'system':
        return 'System'
      case 'light':
        return 'Light'
      case 'dark':
        return 'Dark'
    }
  }, [theme])

  return (
    <ShadowBox>
      <div className="flex flex-row items-start justify-between">
        <div className="flex flex-col gap-y-1">
          <h3>Theme</h3>
          <p className="dark:text-polar-500 text-sm text-gray-400">
            Override your browser&apos;s preferred theme settings
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="justify-between" variant="secondary">
              <span>{getCurrentThemeLabel}</span>
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
      </div>
    </ShadowBox>
  )
}

export default GeneralSettings
