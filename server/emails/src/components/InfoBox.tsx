import { Section, Text } from '@react-email/components'

interface InfoBoxProps {
  title: string
  children: React.ReactNode
  variant?: 'info' | 'warning' | 'error'
}

export function InfoBox({ title, children, variant = 'info' }: InfoBoxProps) {
  const bgColor = {
    info: 'bg-gray-100',
    warning: 'bg-yellow-100',
    error: 'bg-red-100',
  }[variant]

  return (
    <Section className={`${bgColor} my-6 rounded-lg p-4`}>
      <Text className="m-0 mb-2 text-base font-bold text-gray-900">
        {title}
      </Text>
      <div className="text-gray-800">{children}</div>
    </Section>
  )
}

export default InfoBox
