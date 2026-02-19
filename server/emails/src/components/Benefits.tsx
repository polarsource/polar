import { Heading, Markdown, Section } from '@react-email/components'
import { schemas } from '../types'
import { Check, Discord, Download, Gauge, GitHub, Key } from './Icons'

const BenefitIcon = ({
  benefit: { type },
  width,
  height,
}: {
  benefit: schemas['Benefit']
  width: number
  height: number
}) => {
  switch (type) {
    case 'github_repository':
      return <GitHub width={width} height={height} />
    case 'discord':
      return <Discord width={width} height={height} />
    case 'downloadables':
      return <Download width={width} height={height} />
    case 'license_keys':
      return <Key width={width} height={height} />
    case 'meter_credit':
      return <Gauge width={width} height={height} />
    default:
      return <Check width={width} height={height} />
  }
}

const Benefit = ({ benefit }: { benefit: schemas['Benefit'] }) => {
  const { type, description, properties } = benefit
  return (
    <Section className="mb-[12px] rounded-lg border border-solid border-gray-200 p-[12px]">
      <div className="mr-[32px] inline-flex items-start">
        <div className="bg-brand mr-[18px] flex h-[12px] w-[12px] shrink-0 items-center justify-center rounded-full p-[5px] text-[12px] leading-none font-semibold text-white">
          <BenefitIcon benefit={benefit} width={12} height={12} />
        </div>
        <div>
          <Heading as="h2" className="mt-[1px] mb-0 text-[18px] text-gray-900">
            {description}
          </Heading>
          {type === 'custom' && properties.note && (
            <div className="mt-[8px] text-[14px] leading-[24px] text-gray-500">
              <Markdown>{properties.note}</Markdown>
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}

const Benefits = ({ benefits }: { benefits: schemas['Benefit'][] }) => {
  return (
    <Section>
      <Heading as="h2" className="text-lg font-bold">
        Included benefits
      </Heading>
      {benefits.map((benefit, index) => (
        <Benefit key={index} benefit={benefit} />
      ))}
    </Section>
  )
}

export default Benefits
