import { JobSection } from '../JobSection'
import { Section } from '../Section'

export const CareersSection = ({ active }: { active: boolean }) => {
  return (
    <Section
      active={active}
      header={{ index: '02', name: 'Careers' }}
      title="Help us shape the future"
      context={
        <div className="group flex flex-col gap-16">
          <JobSection
            title="Product & Engineering"
            jobs={[
              {
                role: 'Staff Frontend Engineer',
                description:
                  'Come and build the Shadcn of Billing and shape our frontend architecture, standards, and user experience across both our dashboard and SDKs.',
                location: 'Remote — Europe',
                link: 'https://jobs.ashbyhq.com/polar/f47dae43-497f-4ad2-8123-f6e5d23485fb',
                experience: '10+ Years Experience',
              },
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
                role: 'Product Engineer',
                description:
                  'Ship features, APIs and SDKs that empowers the next generation of developers to build businesses.',
                location: 'Remote — Europe',
                link: 'https://jobs.ashbyhq.com/polar/b2b48ba9-0b10-41a2-81b6-145c06fc5dcd',
                experience: '5+ Years Experience',
              },
              {
                role: 'Senior Growth Engineer',
                description:
                  'Design and ship growth-focused features, enhancements and experiments end-to-end.',
                location: 'Remote — Europe',
                link: 'https://jobs.ashbyhq.com/polar/1496592e-16ff-47e7-b11e-a993c887fc1f',
                experience: '7+ Years Experience',
              },
              {
                role: 'Senior Product Designer (On-site)',
                description:
                  'Design the future platform for developers to turn their software into a business.',
                location: 'Stockholm, Sweden',
                link: 'https://jobs.ashbyhq.com/polar/1fee39f0-897c-4bdc-8ec0-a055f5d94a6c',
                experience: '7+ Years Experience',
              },
              {
                role: 'Senior Data Engineer',
                description:
                  'Design, ship and optimize our internal data warehouse to Metric APIs for developers using Polar.',
                location: 'Remote - Europe',
                link: 'https://jobs.ashbyhq.com/polar/0ba77853-a18b-4d38-8516-4b0ab960ea00',
                experience: '7+ Years Experience',
              },
            ]}
          />

          <JobSection
            title="Community"
            jobs={[
              {
                role: 'Head of Developer Relations',
                description:
                  'Build, lead, and scale our developer-facing efforts across community, content and advocacy. You’ll be the voice of Polar.',
                location: 'San Francisco - Remote',
                link: 'https://jobs.ashbyhq.com/polar/d09babe6-f727-42ec-b466-cf074f468f19',
              },
              {
                role: 'Community Manager',
                description:
                  'Nurture and scale our thriving developer community around Polar.',
                location: 'Europe - Remote',
                link: 'https://jobs.ashbyhq.com/polar/67fa55c0-af67-4f90-a88e-db6eab4daac0',
                experience: '3+ Years Experience',
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

          <JobSection
            title="Business & Operations"
            jobs={[
              {
                role: 'Founder Associate (On-site)',
                description:
                  'Support Birk on high-leverage opportunities to mundane must does. No two weeks will look the same.',
                location: 'Stockholm, Sweden',
                link: 'https://jobs.ashbyhq.com/polar/fd957155-cc2e-4ab1-aa58-9c1ee161721c',
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
