import { Section, Text } from '@react-email/components'

export function OTPCode({ code }: { code: string }) {
  return (
    <Section className="my-8 rounded-lg bg-gray-100 p-6 text-center">
      <Text className="m-0 text-5xl font-bold tracking-[10px] text-gray-900">
        {code}
      </Text>
    </Section>
  )
}

export default OTPCode
