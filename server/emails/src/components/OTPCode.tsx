import { Section, Text } from '@react-email/components'

export function OTPCode({ code, domain }: { code: string; domain?: string }) {
  return (
    <Section className="my-8 rounded-lg bg-gray-100 p-6 text-center">
      <Text
        className="m-0 p-0 font-bold text-gray-900"
        style={{ fontSize: 0, lineHeight: '48px', margin: 0, padding: 0 }}
      >
        {code.split('').map((char, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: '44px',
              fontSize: '48px',
              lineHeight: '48px',
              textAlign: 'center',
              verticalAlign: 'middle',
            }}
          >
            {char}
          </span>
        ))}
      </Text>
      {domain && (
        <Text
          className="m-0 text-gray-100"
          style={{ fontSize: 0, lineHeight: 0, height: 0, overflow: 'hidden' }}
        >
          @{domain} #{code}
        </Text>
      )}
    </Section>
  )
}

export default OTPCode
