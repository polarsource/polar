// import { Chart } from '../Chart'
import Image from 'next/image'
import { Link } from '../Link'
import { Section } from '../Section'

const team = [
  {
    name: 'Birk Jernström',
    title: 'Founder & Software Engineer',
    image: '/assets/team/birk.png',
  },
  {
    name: 'Francois Voron',
    title: 'Software Engineer',
    image: '/assets/team/francois.png',
  },
  {
    name: 'Emil Widlund',
    title: 'Design Engineer',
    image: '/assets/team/emil.png',
  },
]

export const TeamSection = ({ active }: { active: boolean }) => {
  return (
    <Section
      active={active}
      header={{ index: '05', name: 'Team' }}
      title="Small team, big ambition"
      context={
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-col gap-y-12 md:flex-row md:gap-x-8">
            {team.map((profile) => (
              <Profile key={profile.name} {...profile} />
            ))}
          </div>

          {/* <Chart */}
          {/*   data={[ */}
          {/*     ...(() => { */}
          {/*       const getWeeksDifferenceInclusive = ( */}
          {/*         startDate: Date, */}
          {/*         endDate: Date, */}
          {/*       ) => { */}
          {/*         // Normalize to the start of the day (no time component) */}
          {/*         const start = new Date(startDate) */}
          {/*         start.setHours(0, 0, 0, 0) */}
          {/**/}
          {/*         const end = new Date(endDate) */}
          {/*         end.setHours(0, 0, 0, 0) */}
          {/**/}
          {/*         // Calculate the difference in milliseconds */}
          {/*         const timeDifference = end.getTime() - start.getTime() */}
          {/**/}
          {/*         // Convert milliseconds to weeks (1 week = 7 days = 7 * 24 * 60 * 60 * 1000 milliseconds) */}
          {/*         const weeks = Math.ceil( */}
          {/*           timeDifference / (7 * 24 * 60 * 60 * 1000), */}
          {/*         ) */}
          {/**/}
          {/*         return weeks */}
          {/*       } */}
          {/**/}
          {/*       const getLastMonthValues = () => { */}
          {/*         const values = [] */}
          {/*         const rawValues = [] */}
          {/*         const startDate = new Date(2024, 8, 30) // September 30, 2024 (Month is zero-indexed) */}
          {/*         const weeksSinceStartDate = getWeeksDifferenceInclusive( */}
          {/*           startDate, */}
          {/*           new Date(), */}
          {/*         ) */}
          {/**/}
          {/*         // Generate raw values */}
          {/*         for (let i = 0; i < weeksSinceStartDate; i++) { */}
          {/*           const timestamp = new Date(startDate) */}
          {/**/}
          {/*           timestamp.setDate(startDate.getDate() + i * 7) // Increment by 7 days per week */}
          {/**/}
          {/*           const value = Math.floor(Math.exp(i / 3)) // Exponential growth */}
          {/*           rawValues.push(value) */}
          {/*           values.push({ */}
          {/*             timestamp, */}
          {/*             value, */}
          {/*           }) */}
          {/*         } */}
          {/**/}
          {/*         // Calculate min and max */}
          {/*         const min = Math.min(...rawValues) */}
          {/*         const max = Math.max(...rawValues) */}
          {/**/}
          {/*         // Normalize values */}
          {/*         return values.map((item) => ({ */}
          {/*           timestamp: item.timestamp, */}
          {/*           value: (item.value - min) / (max - min), */}
          {/*         })) */}
          {/*       } */}
          {/**/}
          {/*       return getLastMonthValues() */}
          {/*     })(), */}
          {/*   ]} */}
          {/*   interval="month" */}
          {/*   metric={{ */}
          {/*     slug: 'value', */}
          {/*     display_name: 'Value', */}
          {/*     type: MetricType.SCALAR, */}
          {/*   }} */}
          {/* /> */}
        </div>
      }
    >
      <p>
        From building startups before to Shop.app, Shop Pay and writing the book
        on FastAPI or React UI engine in Battlefield. Our team is small and
        battle scared.
      </p>
      <p>
        Want to build the future of payments for developers? We&apos;re looking
        for a few senior engineers to join the team.
      </p>
      <p>
        No cover letter needed. Just your best suggestion for how to improve our
        API, SDK or Framework Adapters is the best conversation starter.
      </p>
      <Link href="mailto:birk@polar.sh">Join Us →</Link>
    </Section>
  )
}

interface ProfileProps {
  name: string
  title: string
  image: string
}

const Profile = ({ name, title, image }: ProfileProps) => {
  return (
    <div className="relative flex h-fit w-full flex-col gap-y-4 md:w-[200px]">
      <Image
        className="w-full"
        src={image}
        alt={name}
        width={200}
        height={200}
      />
      <div className="flex flex-col gap-y-1 text-left">
        <h1 className="text-xs">{name}</h1>
        <h1 className="text-polar-500 text-xs">{title}</h1>
      </div>
    </div>
  )
}
