import Avatar from "@polar-sh/ui/components/atoms/Avatar";
import Image from "next/image";
import Link from "next/link";

export const testimonials = [
	{
		link: "https://x.com/mitchellh/status/1775925951668552005",
		name: "Mitchell Hashimoto",
		username: "mitchellh",
		verified: true,
		avatar: "/assets/landing/testamonials/mitchell.jpg",
		text: (
			<>
				<p>I&apos;ve joined Polar as an advisor!</p>
				<p>
					I think it benefits everyone for devs to have more options to get paid
					to work on their passions, to support upstreams, and for users to have
					more confidence/transparency in the software they&apos;re
					supporting/purchasing.
				</p>
			</>
		),
	},
	{
		link: "https://x.com/rauchg/status/1909810055622672851",
		name: "Guillermo Rauch",
		username: "rauchg",
		verified: true,
		avatar: "/assets/landing/testamonials/rauch.jpg",
		text: (
			<p>
				The speed at which Polar is executing on the financial infrastructure
				primitives the new world needs is very impressive
			</p>
		),
	},
	{
		link: "https://x.com/steventey/status/1886124389357490670",
		name: "Steven Tey",
		username: "steventey",
		verified: true,
		avatar: "/assets/landing/testamonials/steven.jpg",
		text: (
			<>
				<p>Open source + great DX + responsive support always wins.</p>
				<p>
					If you&apos;re selling stuff online and haven&apos;t tried @polar_sh
					yet — 100% recommend doing so!
				</p>
			</>
		),
	},
	{
		link: "https://x.com/alexhbass/status/1895688367066747251",
		name: "Alex Bass",
		username: "alexhbass",
		verified: true,
		avatar: "/assets/landing/testamonials/alex.jpg",
		text: (
			<p>
				We switched to @polar_sh because of their killer API, UX, and product.
				Also love that it&apos;s Open-Source. Their team cares A LOT as well.
				Worth the minor fee difference.
			</p>
		),
	},
	{
		name: "Andrea Bizzotto 🇺",
		username: "biz84",
		avatar: "/assets/landing/testamonials/andrea.png",
		link: "https://x.com/biz84/status/1883284175459135808",
		verified: false,
		text: (
			<p>
				I&apos;ve been integrating Polar recently and had a fantastic
				experience! Great DX and the team responds to support super quickly!
			</p>
		),
	},
	{
		name: "enjie",
		username: "im_enjie",
		avatar: "/assets/landing/testamonials/enjie.jpg",
		link: "https://x.com/im_enjie/status/1911490599980519690",
		verified: true,
		text: (
			<p>
				I finally tried @polar_sh after all the hype, and it&apos;s hands down
				the smoothest, most developer-friendly, and straightforward payment
				integration out there.
			</p>
		),
	},
	{
		link: "https://x.com/samuel_colvin/status/1676167205715582978",
		name: "Samuel Colvin",
		username: "samuel_colvin",
		verified: true,
		avatar: "/assets/landing/testamonials/samuel.jpg",
		text: (
			<>
				<p>Amazing! Really excited to seeing how this turns out.</p>
				<p>
					Polar is the cutting edge of how open source might be financed in the
					future.
				</p>
			</>
		),
	},
	{
		link: "https://x.com/LinusEkenstam/status/1831697198280524065",
		name: "Linus Ekenstam",
		username: "LinusEkenstam",
		verified: true,
		avatar: "/assets/landing/testamonials/linus.jpg",
		text: (
			<p>
				I&apos;ve been waiting for this so hard. LFG, congratulations on the
				launch guys!
			</p>
		),
	},
	{
		name: "kitze",
		username: "thekitze",
		avatar: "/assets/landing/testamonials/kitze.jpg",
		link: "https://x.com/thekitze/status/1909217027660595496",
		verified: true,
		text: <p>I just saw the plugin and oh my god</p>,
	},
	{
		name: "Jim Raptis",
		username: "d__raptis",
		avatar: "/assets/landing/testamonials/jim.jpg",
		link: "https://x.com/d__raptis/status/1896551633917477156",
		verified: true,
		text: (
			<>
				<p>
					I&apos;ve migrated the http://gradients.fm pre-order checkout to
					@polar_sh 💳
				</p>
				<p>Much quicker to load and has a more beautiful checkout page imo.</p>
			</>
		),
	},
	{
		name: "Jonathan Bloomfield",
		username: "Champdebloom",
		avatar: "/assets/landing/testamonials/bloomfield.jpg",
		link: "https://x.com/Champdebloom/status/1908571341915107698",
		verified: true,
		text: (
			<>
				<p>
					I spent hours wrestling with Stripe last night and I know it&apos;s a
					skill issue, but @polar_sh&apos;s DX is so peak this wouldn&apos;t
					have been a problem.
				</p>
				<p>
					Just waiting on CAD support so I can migrate and it can&apos;t come
					soon enough!
				</p>
			</>
		),
	},
	{
		name: "Dmitry Vlasov",
		username: "vlasov",
		avatar: "/assets/landing/testamonials/dmitry.jpg",
		link: "https://x.com/vlasov/status/1908428846371864880",
		verified: true,
		text: (
			<p>
				Someone here recommended @polar_sh, and I can only say the experience
				has been very smooth so far.
			</p>
		),
	},
	{
		name: "Filip K",
		username: "itsfilipk",
		link: "https://x.com/itsfilipk/status/1910238399820165140",
		verified: true,
		avatar: "/assets/landing/testamonials/filip.jpg",
		text: (
			<>
				<p>
					In 8 years as a developer I can&apos;t recall having such a smooth
					onboarding + integration experience as with @polar_sh . Everything
					from the UI, docs and CLI tool is intuitive and &apos;just
					works&apos;.
				</p>
				<p>
					If you are looking to integrate international payments into your
					business, I can&apos;t recommend them enough.
				</p>
			</>
		),
	},
	{
		link: "https://x.com/Mike_Andreuzza/status/1856338674406875385",
		name: "Mike Andreuzza",
		username: "Mike_Andreuzza",
		verified: true,
		avatar: "/assets/landing/testamonials/mike.jpg",
		text: (
			<>
				<p>
					Officially using @polar_sh for payments and lowered prices on
					Lexington.
				</p>
				<p>
					I also want to thank @birk and the people at Polar for helping me out
					with the move and adapting the UI to my use case during the move. They
					are worth their weight in gold.
				</p>
			</>
		),
	},
	{
		link: "https://x.com/jonathan_wilke/status/1896551633917477156",
		name: "Jonathan Wilke",
		username: "jonathan_wilke",
		verified: true,
		avatar: "/assets/landing/testamonials/jonathan.jpg",
		text: (
			<p>
				Wow this is just amazing. With @polar_sh I can directly give the
				customer access to the supastarter repository and invite them to the
				discord server 🔥🚀
			</p>
		),
	},
	{
		link: "https://x.com/b_shulha/status/1894387529299739123",
		name: "Bohdan Shulha",
		username: "b_shulha",
		verified: true,
		avatar: "/assets/landing/testamonials/bohdan.jpg",
		text: (
			<>
				<p>I feel like @polar_sh is @vercel of payments.</p>
				<p>Keep pushing! 💘</p>
			</>
		),
	},
	{
		link: "https://x.com/dparksdev/status/1902848435318935690",
		name: "David Parks",
		username: "dparksdev",
		verified: true,
		avatar: "/assets/landing/testamonials/david.jpg",
		text: (
			<>
				<p>The @polar_sh plugin for @better_auth is magic.</p>
				<ul className="list-disc pl-4">
					<li>Automatically creates customers on signup</li>
					<li>Maps your databases id to an external id for reference</li>
					<li>Creates checkout, portal and webhook routes for you</li>
				</ul>
			</>
		),
	},
];

interface TestamonialProps {
	name: string;
	username: string;
	avatar: string;
	text: React.ReactNode;
	link: string;
	verified?: boolean;
}

export const Testamonial = ({
	name,
	username,
	avatar,
	text,
	link,
	verified,
}: TestamonialProps) => {
	return (
		<Link
			href={link}
			target="_blank"
			className="dark:bg-polar-900 dark:border-polar-800 dark:hover:bg-polar-800 flex h-full flex-row gap-x-4 rounded-2xl border border-transparent bg-white p-6 transition-colors hover:bg-white"
		>
			<div className="flex flex-col gap-y-4 pt-1.5">
				<div className="flex flex-row items-center gap-x-3">
					<Avatar
						name={name}
						avatar_url={avatar}
						className="h-12 w-12"
						width={48}
						height={48}
						loading="lazy"
						CustomImageComponent={Image}
					/>
					<div className="flex flex-col text-sm">
						<div className="flex flex-row items-center gap-x-2">
							<span>{name}</span>
							{verified && <VerifiedBadge />}
						</div>
						<span className="dark:text-polar-500 text-gray-500">
							@{username}
						</span>
					</div>
				</div>
				<div className="flex flex-col gap-y-6">
					<div className="dark:text-polar-100 flex flex-col gap-y-4 text-gray-950">
						{text}
					</div>
				</div>
			</div>
		</Link>
	);
};

export const Testimonials = () => {
	const halfLength = Math.ceil(testimonials.length / 2);
	const firstRow = testimonials.slice(0, halfLength);
	const secondRow = testimonials.slice(halfLength);

	return (
		<div className="flex flex-col items-center gap-y-12 md:gap-y-24">
			<div className="flex flex-col gap-4 md:relative md:w-full md:overflow-hidden">
				<div className="flex flex-col gap-y-4 md:hidden">
					{firstRow.map((testimonial, index) => (
						<Testamonial key={`testimonial-${index}`} {...testimonial} />
					))}
				</div>
				<div className="hidden flex-col gap-y-4 md:flex md:w-screen">
					{/* First row */}
					<div className="flex flex-col gap-y-4 md:w-max md:animate-[infinite-scroll_50s_linear_infinite_forwards] md:flex-row md:gap-x-4">
						{[...firstRow, ...firstRow, ...firstRow].map(
							(testimonial, index) => (
								<div key={`row1-${index}`} className="md:w-[400px]">
									<Testamonial {...testimonial} />
								</div>
							),
						)}
					</div>

					{/* Second row */}
					<div className="flex flex-col gap-y-4 md:w-max md:animate-[infinite-scroll_50s_linear_infinite_forwards] md:flex-row md:gap-x-4">
						{[...secondRow, ...secondRow, ...secondRow].map(
							(testimonial, index) => (
								<div key={`row2-${index}`} className="md:w-[400px]">
									<Testamonial {...testimonial} />
								</div>
							),
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

const VerifiedBadge = () => {
	return (
		<div className="relative flex">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="fill-[#1D9BF0] text-[#1D9BF0]"
			>
				<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"></path>
			</svg>
			<div className="absolute inset-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="8"
					height="8"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="3"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="text-white"
				>
					<path d="M20 6 9 17l-5-5"></path>
				</svg>
			</div>
		</div>
	);
};
