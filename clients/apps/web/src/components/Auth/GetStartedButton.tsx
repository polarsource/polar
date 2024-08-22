import { ArrowForwardOutlined } from '@mui/icons-material'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

interface GetStartedButtonProps extends ComponentProps<typeof Button> {
  text?: string
  href?: string
}

const GetStartedButton: React.FC<GetStartedButtonProps> = ({
  text: _text,
  href: _href,
  wrapperClassNames,
  size = 'lg',
  ...props
}) => {
  const text = _text || 'Start for free'
  const href = _href ? _href : '/signup'
  return (
    <Link href={href}>
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
