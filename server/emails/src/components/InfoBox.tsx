import { Section } from 'react-email'
import { Text } from './foundation'

interface InfoBoxProps {
  title: string
  children: React.ReactNode
  variant?: 'info' | 'warning' | 'error'
}

export function InfoBox({ title, children, variant = 'info' }: InfoBoxProps) {
  const bgColor = {
    info: 'bg-gray-100',
    warning: 'bg-yellow-50',
    error: 'bg-red-100',
  }[variant]

  return (
    <Section className={`${bgColor} my-6 rounded-lg p-6`}>
      <Text weight="bold" noMargin>
        {title}
      </Text>
      <div className="text-gray-800">{children}</div>
    </Section>
  )
}

export default InfoBox
