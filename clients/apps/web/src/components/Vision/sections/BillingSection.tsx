import { Console } from "../Console";
import { Section } from "../Section";

export const BillingSection = ({ active }: { active: boolean }) => {
	return (
		<Section
			active={active}
			header={{ index: "02", name: "Seamless Billing" }}
			title="Complex billing made easy"
			context={<Console title="NextJS Adapter" code={""} />}
		>
			<p>
				Understandable fear and complexity around overages, credits and spend
				limits is holding the ecosystem back from experimenting &amp; innovating
				on pricing.
			</p>
			<p>
				We&apos;re hell-bent at removing all those headaches and concerns for
				developers and their customers. Both from a technical and business
				perspective.
			</p>
			<p>New times deserve new pricing.</p>
			<strong>Focus ahead:</strong>
			<ul>
				<li>
					<p>- Unlimited events and meters per product</p>
				</li>
				<li>
					<p>- Middleware and adapters to automate metering</p>
				</li>
				<li>
					<p>- Real-time dashboard of events, costs and revenue/customer</p>
				</li>
				<li>
					<p>- @shadcn-like components for customer forecast &amp; controls</p>
				</li>
			</ul>
		</Section>
	);
};
