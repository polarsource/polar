import { Chart } from "../Chart";
import { Section } from "../Section";
import { Testamonial } from "../Testamonial";

const testamonials = [
	{
		user: {
			avatar: "/assets/vision/steven.jpg",
			username: "steventey",
		},
		text: "Open source + great DX + responsive support always wins. If you’re selling stuff online and haven’t tried @polar_sh yet — 100% recommend doing so!",
	},
	{
		user: {
			avatar: "/assets/vision/pontus.jpg",
			username: "pontusab",
		},
		text: "You can tell @polar_sh is building DX first!",
	},
	{
		user: {
			avatar: "/assets/vision/alex.jpg",
			username: "alexhbass",
		},
		text: "We switched to @polar_sh because of their killer API, UX, and product. Also love that it's Open-Source. Their team cares A LOT as well.",
	},
	{
		user: {
			avatar: "/assets/vision/mike.jpg",
			username: "Mike_Andreuzza",
		},
		text: "Been on @polar_sh since November, zero issues, zero complaints, great customer service that goes over the extra mile...",
	},
];

export const IndexSection = ({ active }: { active: boolean }) => {
	const data = [
		{ timestamp: new Date("2023-03-01"), value: 0.0 },
		{ timestamp: new Date("2023-04-01"), value: 0.0 },
		{ timestamp: new Date("2023-05-01"), value: 0.0 },
		{ timestamp: new Date("2023-06-01"), value: 0.0 },
		{ timestamp: new Date("2023-07-01"), value: 0.0 },
		{ timestamp: new Date("2023-08-01"), value: 0.0 },
		{ timestamp: new Date("2023-09-01"), value: 0.0 },
		{ timestamp: new Date("2023-10-01"), value: 0.0 },
		{ timestamp: new Date("2023-11-01"), value: 0.0 },
		{ timestamp: new Date("2023-12-01"), value: 0.0 },
		{ timestamp: new Date("2024-01-01"), value: 0.0 },
		{ timestamp: new Date("2024-02-01"), value: 0.0 },
		{ timestamp: new Date("2024-03-01"), value: 0.0 },
		{ timestamp: new Date("2024-04-01"), value: 0.0125 },
		{ timestamp: new Date("2024-05-01"), value: 0.0207 },
		{ timestamp: new Date("2024-06-01"), value: 0.0208 },
		{ timestamp: new Date("2024-07-01"), value: 0.0216 },
		{ timestamp: new Date("2024-08-01"), value: 0.0262 },
		{ timestamp: new Date("2024-09-01"), value: 0.0531 },
		{ timestamp: new Date("2024-10-01"), value: 0.0647 },
		{ timestamp: new Date("2024-11-01"), value: 0.5201 },
		{ timestamp: new Date("2024-12-01"), value: 0.6311 },
		{ timestamp: new Date("2025-01-01"), value: 0.6434 },
		{ timestamp: new Date("2025-02-01"), value: 1.0 },
	];

	return (
		<Section
			active={active}
			header={{ index: "00", name: "Index" }}
			title="Reimagining the future of digital products"
			context={
				<div className="flex flex-col gap-y-6 md:max-w-4xl">
					<Chart
						interval="month"
						metric={{
							display_name: "Revenue Trend",
							type: "currency",
							slug: "value",
						}}
						data={data}
					/>
					<div className="grid md:grid-cols-2 grid-cols-1 gap-4">
						{testamonials.map((t) => (
							<Testamonial key={t.text} {...t} />
						))}
					</div>
				</div>
			}
		>
			<p>We believe the future belongs to developers building businesses.</p>
			<p>
				It&apos;s never been easier to build, ship and scale software thanks to
				modern frameworks, IaaS-, PaaS- and BaaS services to LLMs.
			</p>
			<p>
				Yet, payments &amp; billing has never been more complex. We&apos;re
				obsessed about changing this.
			</p>
			<p>
				<strong>We call it Polar.</strong>
			</p>
		</Section>
	);
};
