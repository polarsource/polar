import { Section, Text } from '@react-email/components'

interface InfoBoxProps {
  title: string
  children: React.ReactNode
  variant?: 'info' | 'warning' | 'error'
}

export function InfoBox({ title, children, variant = 'info' }: InfoBoxProps) {
  const bgColor = {
    info: 'bg-gray-100 dark:bg-gray-800',
    warning: 'bg-yellow-100 dark:bg-yellow-900',
    error: 'bg-red-100 dark:bg-red-900',
  }[variant]

  return (
    <Section className={`${bgColor} my-6 rounded-lg p-4`}>
      <Text className="m-0 mb-2 text-base font-bold text-gray-900 dark:text-white">
        {title}
      </Text>
      <div className="text-gray-800 dark:text-gray-200">{children}</div>
    </Section>
  )
}

export default InfoBox
