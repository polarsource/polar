import {
	ResourceLayout,
	ResourceSection,
} from "@/components/Landing/resources/ResourceLayout";
import { Metadata } from "next";

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

export default function Resources() {
	const toc = [
		{
			id: "index",
			title: "Index",
		},
	];

	return (
		<ResourceLayout title="Resources" toc={toc}>
			<ResourceSection id="index" title="Index"></ResourceSection>
		</ResourceLayout>
	);
}
