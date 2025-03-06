import { twMerge } from "tailwind-merge";

export interface SectionProps {
	active: boolean;
	header: {
		index: string;
		name: string;
	};
	title: string;
	children: React.ReactNode;
	context?: React.ReactNode;
}

export const Section = ({
	active,
	header,
	title,
	children,
	context,
}: SectionProps) => {
	let desktopClasses = "md:hidden";
	if (active) {
		desktopClasses = "md:flex-row md:gap-x-32";
	}

	return (
		<div
			id={header.index}
			className={twMerge(desktopClasses, "mb-16 flex flex-col gap-y-16")}
		>
			<div className="flex max-w-lg flex-col gap-y-8">
				<div className="flex flex-row items-center gap-x-4">
					<span className="bg-polar-200 px-1 py-0.5 text-sm leading-none text-black">
						{header.index}.
					</span>
					<h1 className="text-lg">{header.name}</h1>
				</div>
				<h1 className="text-balance text-3xl leading-tight">{title}</h1>
				<div className="flex flex-col gap-y-8 text-justify">{children}</div>
			</div>
			{context}
		</div>
	);
};
