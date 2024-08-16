import { ArrowForwardOutlined } from '@mui/icons-material'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

interface GetStartedButtonProps extends ComponentProps<typeof Button> {
  text?: string
  returnTo?: string
}

const GetStartedButton: React.FC<GetStartedButtonProps> = ({
  text: _text,
  returnTo: _returnTo,
  wrapperClassNames,
  size = 'lg',
  ...props
}) => {
  const text = _text || 'Start for free'
  const returnTo = _returnTo ? encodeURIComponent(_returnTo) : '/dashboard'
  return (
    <Link href={`/login${returnTo ? `?return_to=${returnTo}` : ''}`}>
      <Button
        wrapperClassNames={twMerge(
          'flex flex-row items-center gap-x-2',
          wrapperClassNames,
        )}
        size={size}
        {...props}
      >
        <div>{text}</div>
        <ArrowForwardOutlined
          className={size === 'lg' ? 'text-lg' : 'text-md'}
          fontSize="inherit"
        />
      </Button>
    </Link>
  )
}

export default GetStartedButton
