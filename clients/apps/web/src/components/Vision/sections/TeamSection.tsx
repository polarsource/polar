import { MetricType } from '@polar-sh/api'
import Image from 'next/image'
import { Chart } from '../Chart'
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

export const TeamSection = () => {
  return (
    <Section
      header={{ index: '05', name: 'Team' }}
      title="We are hiring"
      context={
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-col gap-y-12 md:flex-row md:gap-x-8">
            {team.map((profile) => (
              <Profile key={profile.name} {...profile} />
            ))}
          </div>

          <Chart
            data={[
              ...(() => {
                const getWeeksDifferenceInclusive = (
                  startDate: Date,
                  endDate: Date,
                ) => {
                  // Normalize to the start of the day (no time component)
                  const start = new Date(startDate)
                  start.setHours(0, 0, 0, 0)

                  const end = new Date(endDate)
                  end.setHours(0, 0, 0, 0)

                  // Calculate the difference in milliseconds
                  const timeDifference = end.getTime() - start.getTime()

                  // Convert milliseconds to weeks (1 week = 7 days = 7 * 24 * 60 * 60 * 1000 milliseconds)
                  const weeks = Math.ceil(
                    timeDifference / (7 * 24 * 60 * 60 * 1000),
                  )

                  return weeks
                }

                const getLastMonthValues = () => {
                  const values = []
                  const rawValues = []
                  const startDate = new Date(2024, 8, 30) // September 30, 2024 (Month is zero-indexed)
                  const weeksSinceStartDate = getWeeksDifferenceInclusive(
                    startDate,
                    new Date(),
                  )

                  // Generate raw values
                  for (let i = 0; i < weeksSinceStartDate; i++) {
                    const timestamp = new Date(startDate)

                    timestamp.setDate(startDate.getDate() + i * 7) // Increment by 7 days per week

                    const value = Math.floor(Math.exp(i / 3)) // Exponential growth
                    rawValues.push(value)
                    values.push({
                      timestamp,
                      value,
                    })
                  }

                  // Calculate min and max
                  const min = Math.min(...rawValues)
                  const max = Math.max(...rawValues)

                  // Normalize values
                  return values.map((item) => ({
                    timestamp: item.timestamp,
                    value: (item.value - min) / (max - min),
                  }))
                }

                return getLastMonthValues()
              })(),
            ]}
            interval="month"
            metric={{
              slug: 'value',
              display_name: 'Value',
              type: MetricType.SCALAR,
            }}
          />
        </div>
      }
    >
      <p>
        Are you passionate about building the future of payment infrastructure?
        Get in touch.
      </p>
      <ul className="border-polar-200 flex flex-col gap-y-4 border-l pl-4">
        <li>
          You are passionate about building great user experiences and products.
        </li>
        <li>
          You&apos;re humble and eager to constantly learn and improve based on
          feedback from customers and peers or new insights, technical trends
          and tools.
        </li>
        <li>
          You&apos;re autonomous and don&apos;t hesitate to roll up your sleeves
          to get stuff done vs. waiting on instructions, guidance or permission.
        </li>
      </ul>
      <Link href="/pitch/what">Join Us →</Link>
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
