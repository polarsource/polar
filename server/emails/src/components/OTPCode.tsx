/* eslint-disable email-ds/no-raw-text-elements -- bespoke per-digit OTP widget; not prose text */
import { Section } from 'react-email'

export function OTPCode({ code, domain }: { code: string; domain?: string }) {
  return (
    <Section className="my-8 rounded-lg bg-gray-100 p-6 text-center">
      <p
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
      </p>
      {domain && (
        <p
          className="m-0 text-gray-100"
          style={{ fontSize: 0, lineHeight: 0, height: 0, overflow: 'hidden' }}
        >
          @{domain} #{code}
        </p>
      )}
    </Section>
  )
}

export default OTPCode
