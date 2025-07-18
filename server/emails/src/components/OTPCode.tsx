import { Section, Text } from '@react-email/components'

export function OTPCode({ code }: { code: string }) {
  return (
    <Section className="my-8 rounded-lg bg-gray-100 p-6 text-center dark:bg-gray-800">
      <Text className="m-0 text-5xl font-bold tracking-[10px] text-gray-900 dark:text-gray-100">
        {code}
      </Text>
    </Section>
  )
}

export default OTPCode
