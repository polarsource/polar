import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'

const messages: Record<schemas['FeedbackType'], string> = {
  feedback:
    'Thanks for sharing this with us. Notes like this are how we decide what to build next.',
  bug: "Thanks for flagging. We'll investigate and reach out if we need more detail.",
  question: 'Thanks for reaching out. We will get back to you shortly.',
}

export const ThanksPanel = ({ type }: { type: schemas['FeedbackType'] }) => {
  return (
    <Alert
      title="Successfully sent"
      variant="success"
      description={messages[type]}
    />
  )
}
