import pako from 'pako'
import { CONFIG } from 'polarkit'

interface EmailMermaidProps {
  graphDefinition: string
}

export const EmailMermaid: React.FC<EmailMermaidProps> = ({
  graphDefinition,
}) => {
  const compressed = pako.deflate(graphDefinition)
  const base64Graph = Buffer.from(compressed).toString('base64url')

  return (
    <center>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${CONFIG.FRONTEND_BASE_URL}/email/kroki/mermaid/${base64Graph}`}
        alt="Mermaid"
      />
    </center>
  )
}

export default EmailMermaid
