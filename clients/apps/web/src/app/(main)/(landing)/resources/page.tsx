import { ResourceLayout } from "@/components/Landing/resources/ResourceLayout";
import { ArrowForwardOutlined } from "@mui/icons-material";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Polar — Payment infrastructure for the 21st century",
	description: "Payment infrastructure for the 21st century",
	keywords:
		"monetization, merchant of record, saas, digital products, platform, developer, open source, funding, open source, economy",
	openGraph: {
		siteName: "Polar",
		type: "website",
		images: [
			{
				url: "https://polar.sh/assets/brand/polar_og.jpg",
				width: 1200,
				height: 630,
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		images: [
			{
				url: "https://polar.sh/assets/brand/polar_og.jpg",
				width: 1200,
				height: 630,
				alt: "Polar",
			},
		],
	},
};

const resourceLinks = [
	{
		title: "Why Polar",
		href: "/resources/why",
	},
	{
		title: "Merchant of Record",
		href: "/resources/mor",
	},
	{
		title: "Pricing",
		href: "/resources/pricing",
	},
] as const;

export default function Resources() {
	return (
		<ResourceLayout decoration={false} title="Resources">
			<div className="flex flex-col gap-y-8 md:gap-y-16">
				<div className="divide-y dark:divide-polar-700 flex flex-col divide-gray-300 border-y border-gray-300 dark:border-polar-700">
					{resourceLinks.map((link) => (
						<Link
							key={link.title}
							className="dark:hover:bg-polar-800 justify-between flex w-full cursor-pointer items-center gap-3 p-3 transition-colors duration-200 hover:bg-gray-100"
							href={link.href}
						>
							<span>{link.title}</span>
							<ArrowForwardOutlined fontSize="inherit" />
						</Link>
					))}
				</div>
			</div>
		</ResourceLayout>
	);
}
