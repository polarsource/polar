import Image from 'next/image'
import { Link } from '../Link'

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
    <div className="flex flex-col gap-y-16 md:flex-row md:gap-x-32">
      <div className="flex max-w-lg flex-col gap-y-8">
        <h1 className="text-lg">05. Team</h1>
        <h1 className="text-4xl">We are hiring</h1>
        <p>
          What used to be a simple way to pay for things has become a complex
          mess.
        </p>
        <p>
          Software as a Service (SaaS) has become the norm, but the underlying
          payment infrastructure has not evolved.
        </p>
        <p>
          This is why we are building Polar 2.0, payment infrastructure for the
          21st century.
        </p>
        <Link href="/pitch/what">Join Us →</Link>
      </div>
      <div className="flex flex-row gap-x-4">
        {team.map((profile) => (
          <Profile key={profile.name} {...profile} />
        ))}
      </div>
    </div>
  )
}

interface ProfileProps {
  name: string
  title: string
  image: string
}

const Profile = ({ name, title, image }: ProfileProps) => {
  return (
    <div className="flex h-fit w-[200px] flex-col gap-y-4">
      <Image src={image} alt={name} width={200} height={200} />
      <div className="flex flex-col gap-y-1">
        <h1 className="text-xs">{name}</h1>
        <h1 className="text-polar-500 text-xs">{title}</h1>
      </div>
    </div>
  )
}
