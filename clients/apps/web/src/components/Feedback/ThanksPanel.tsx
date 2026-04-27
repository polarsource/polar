import { schemas } from '@polar-sh/client'
import Alert from '@polar-sh/ui/components/atoms/Alert'

const messages: Record<schemas['FeedbackType'], string> = {
  feedback:
    'Thanks for sharing this with us. Notes like this are how we decide what to build next.',
  bug: "Thanks for flagging. We'll investigate and reach out if we need more detail.",
  // `question` is hidden for now
  question: 'Thanks for reaching out. We will get back to you shortly.',
}

export const ThanksPanel = ({ type }: { type: schemas['FeedbackType'] }) => {
  return (
    <Alert color="green" className="p-4 text-sm">
      {messages[type]}
    </Alert>
  )
}
