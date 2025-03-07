// import { Chart } from '../Chart'
import Image from "next/image";
import { Link } from "../Link";
import { Section } from "../Section";

const team = [
	{
		name: "Birk Jernström",
		title: "Founder & Software Engineer",
		image: "/assets/team/birk.png",
	},
	{
		name: "Francois Voron",
		title: "Software Engineer",
		image: "/assets/team/francois.png",
	},
	{
		name: "Emil Widlund",
		title: "Design Engineer",
		image: "/assets/team/emil.png",
	},
];

export const TeamSection = ({ active }: { active: boolean }) => {
	return (
		<Section
			active={active}
			header={{ index: "05", name: "Team" }}
			title="Small team, big ambition"
			context={
				<div className="flex flex-col gap-y-8">
					<div className="flex flex-col gap-y-12 md:flex-row md:gap-x-8">
						{team.map((profile) => (
							<Profile key={profile.name} {...profile} />
						))}
					</div>
				</div>
			}
		>
			<p>
				From building startups before to Shop.app, Shop Pay and writing the book
				on FastAPI or React UI engine in Battlefield. Our team is small and
				battle scarred.
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
	);
};

interface ProfileProps {
	name: string;
	title: string;
	image: string;
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
	);
};
