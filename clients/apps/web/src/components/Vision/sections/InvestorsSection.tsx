import { Section } from '../Section'

export const InvestorsSection = ({
  investors,
  active,
}: {
  investors: { name: string; company: string }[]
  active: boolean
}) => {
  return (
    <Section
      active={active}
      header={{ index: '03', name: 'Investors' }}
      title="Investors, Angels & Advisors"
      context={
        <div className="flex flex-col gap-12 md:flex-row">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
            {investors.map((investor) => (
              <div className="flex flex-col" key={investor.name}>
                <h4>{investor.name}</h4>
                <span className="text-polar-500">{investor.company}</span>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <p>
        The incredible people and early stage firms who have had our back
        through thick and thin - supporting us from Day 1.
      </p>
    </Section>
  )
}
