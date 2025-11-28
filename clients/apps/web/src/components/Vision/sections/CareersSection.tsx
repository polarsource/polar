import { JobSection } from '../JobSection'
import { Section } from '../Section'

export const CareersSection = ({ active }: { active: boolean }) => {
  return (
    <Section
      active={active}
      header={{ index: '02', name: 'Careers' }}
      title="Help us shape the future"
      context={
        <div className="group flex flex-col gap-8 lg:gap-16">
          <JobSection
            title="Product & Engineering"
            jobs={[
              {
                role: 'Staff Infrastructure Engineer',
                description:
                  'Own the end-to-end architecture and implementation of our infrastructure to ensure world-class uptime and latency.',
                location: 'Remote — Europe',
                link: 'https://jobs.ashbyhq.com/polar/e610cfb0-a883-4138-aef0-f826f82958cb',
                experience: '8+ Years Experience',
              },
              {
                role: 'Senior Product Engineer',
                description:
                  'Ship features, APIs and SDKs that empowers the next generation of developers to build businesses.',
                location: 'Remote — Europe',
                link: 'https://jobs.ashbyhq.com/polar/955c6935-6d03-46e5-b649-a8b958a52962',
                experience: '7+ Years Experience',
              },
              {
                role: 'Senior Growth Engineer',
                description:
                  'Design and ship growth-focused features, enhancements and experiments end-to-end.',
                location: 'Remote — Europe',
                link: 'https://jobs.ashbyhq.com/polar/1496592e-16ff-47e7-b11e-a993c887fc1f',
                experience: '7+ Years Experience',
              },
            ]}
          />
          <JobSection
            title="Customer Success"
            jobs={[
              {
                role: 'Support Engineer',
                description:
                  'Help provide exceptional support to developers world-wide and scale our efforts by improving docs, guides and internal tooling.',
                location: 'Europe - Remote',
                link: 'https://jobs.ashbyhq.com/polar/3b7b5522-3781-4a6b-b112-5ad93320192a',
                experience: '2+ Years Experience',
              },
            ]}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-y-6">
        <div className="flex flex-col gap-y-1">
          <h3 className="text-polar-50">Momentum is Culture</h3>
          <p className="text-polar-500">
            We focus on keeping, celebrating and accelerating momentum. Allowing
            culture to be continuously improved and fluid vs. fixed.
          </p>
        </div>
        <div className="flex flex-col gap-y-1">
          <h3 className="text-polar-50">Ship / Refactor / Scale</h3>
          <p className="text-polar-500">
            Our #1 focus and drive is shipping and growing great product
            experiences that solves real problems for developers and their
            users.
          </p>
        </div>
        <div className="flex flex-col gap-y-1">
          <h3 className="text-polar-50">Do your life&apos;s work</h3>
          <p className="text-polar-500">
            We&apos;re not a 9-5 nor 24/7. We don&apos;t track time nor search
            for people who count it down. But we continuously push the envelope
            of our creativity & productivity.
          </p>
        </div>
      </div>
    </Section>
  )
}
