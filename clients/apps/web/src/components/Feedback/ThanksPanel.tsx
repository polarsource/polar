import { useAuth } from '@/hooks/auth'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'

const getMessage = (
  type: schemas['FeedbackType'],
  email: string | undefined,
): string => {
  const address = email ?? 'your account email'
  switch (type) {
    case 'feedback':
      return 'Thanks for sharing this with us. Notes like this are how we decide what to build next.'
    case 'bug':
      return `Thanks for flagging. We'll investigate and email you at ${address} if we need more detail.`
    case 'question':
      return `Thanks for reaching out. We'll reply by email to ${address}, so keep an eye on your inbox (and spam folder).`
  }
}

export const ThanksPanel = ({ type }: { type: schemas['FeedbackType'] }) => {
  const { currentUser } = useAuth()

  return (
    <Alert
      title="Successfully sent"
      variant="success"
      description={getMessage(type, currentUser?.email)}
    />
  )
}
