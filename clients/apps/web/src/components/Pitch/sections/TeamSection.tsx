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

export const TeamSection = () => {
  return (
    <Section header={{ index: '05', name: 'Team' }} title="We are hiring">
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
      <div className="flex flex-col gap-y-12 md:flex-row md:gap-x-4">
        {team.map((profile) => (
          <Profile key={profile.name} {...profile} />
        ))}
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
    <div className="relative flex h-fit w-full flex-col gap-y-4 md:w-[200px]">
      <Image
        className="w-full"
        src={image}
        alt={name}
        width={200}
        height={200}
      />
      <div className="flex flex-col gap-y-1">
        <h1 className="text-xs">{name}</h1>
        <h1 className="text-polar-500 text-xs">{title}</h1>
      </div>
    </div>
  )
}
