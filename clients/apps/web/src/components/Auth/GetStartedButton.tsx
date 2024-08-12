import { ArrowForwardOutlined } from '@mui/icons-material'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { twMerge } from 'tailwind-merge'

interface GetStartedButtonProps {
  text?: string
  returnTo?: string
  wrapperClassNames?: string
  className?: string
}

const GetStartedButton: React.FC<GetStartedButtonProps> = ({
  text: _text,
  returnTo: _returnTo,
  wrapperClassNames,
  className,
}) => {
  const text = _text || 'Get started'
  const returnTo = _returnTo ? encodeURIComponent(_returnTo) : '/dashboard'
  return (
    <Link href={`/login${returnTo ? `?return_to=${returnTo}` : ''}`}>
      <Button
        wrapperClassNames={twMerge('space-x-3 p-2.5 px-5', wrapperClassNames)}
        className={twMerge('text-md p-5', className)}
      >
        <div>{text}</div>
        <ArrowForwardOutlined className="h-5 w-5" />
      </Button>
    </Link>
  )
}

export default GetStartedButton
