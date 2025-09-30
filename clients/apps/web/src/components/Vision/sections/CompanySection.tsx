import Image from 'next/image'
import { Link } from '../Link'
import { Section } from '../Section'

const team = [
  {
    name: 'Birk Jernström',
    title: 'CEO & Founder',
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
  {
    name: 'Petru Rares Sincraian',
    title: 'Software Engineer',
    image: '/assets/team/petru.png',
  },
  {
    name: 'Rishi Raj Jain',
    title: 'Customer Success Engineer',
    image: '/assets/team/rishi.png',
  },
  {
    name: 'Pieter Beulque',
    title: 'Software Engineer',
    image: '/assets/team/pieter.png',
  },
]

export const CompanySection = ({ active }: { active: boolean }) => {
  return (
    <Section
      active={active}
      header={{ index: '05', name: 'Company' }}
      title="Small team, big ambitions"
      context={
        <div className="flex flex-col gap-y-8">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
            {team.map((profile) => (
              <Profile key={profile.name} {...profile} />
            ))}
          </div>
        </div>
      }
    >
      <p>
        We believe the next unicorns will be created by individual developers.
        As lines blur between indie hackers, startups, and enterprises,
        we&apos;re building Polar to empower solo builders and early-stage
        startups – the future enterprises, without the headcount.
      </p>
      <p>
        Polar is a small team with big ambitions, empowered by a culture of
        ownership and autonomy. We&apos;re proud to be open source & built for
        transparency to shape the future with our community.
      </p>
      <div className="flex flex-col gap-y-2">
        <Link href="https://github.com/polarsource" target="_blank" prefetch>
          Polar on GitHub →
        </Link>
        <Link href="https://x.com/polar_sh" target="_blank" prefetch>
          Join the conversation →
        </Link>
      </div>
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
    <div className="relative flex aspect-square h-fit w-full flex-col gap-y-4">
      <Image
        className="w-full"
        src={image}
        alt={name}
        width={200}
        height={200}
      />
      <div className="flex flex-col text-left">
        <h1 className="text-xs">{name}</h1>
        <h1 className="text-polar-500 text-xs">{title}</h1>
      </div>
    </div>
  )
}
