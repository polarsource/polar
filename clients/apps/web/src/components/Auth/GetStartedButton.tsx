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
  const text = _text || 'Get Started'
  const returnTo = _returnTo ? encodeURIComponent(_returnTo) : '/dashboard'
  return (
    <Link href={`/login${returnTo ? `?return_to=${returnTo}` : ''}`}>
      <Button
        wrapperClassNames={twMerge('space-x-3 p-2.5', wrapperClassNames)}
        className={twMerge('text-md p-5', className)}
      >
        {text}
      </Button>
    </Link>
  )
}

export default GetStartedButton
