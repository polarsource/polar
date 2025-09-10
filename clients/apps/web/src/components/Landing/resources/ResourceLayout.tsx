"use client";

import { ArrowDownwardOutlined } from "@mui/icons-material";
import { PropsWithChildren, useCallback } from "react";
import { twMerge } from "tailwind-merge";

export const ResourceLayout = ({
	title,
	children,
	toc,
	decoration = true,
}: PropsWithChildren<{
	title: string;
	decoration?: boolean;
	children: React.ReactNode;
	toc?: { id: string; title: string }[];
}>) => {
	const scrollToSection = useCallback((id: string) => {
		const section = document.getElementById(id);
		if (section) {
			section.scrollIntoView({ behavior: "smooth" });
		}
	}, []);

	return (
		<div className="flex min-h-screen flex-col">
			{/* Main Content */}
			<main>
				<div className="mx-auto flex w-full max-w-6xl flex-col px-2 lg:px-8">
					{/* Content Card */}
					<div className="dark:md:bg-polar-900 flex flex-col gap-y-8 rounded-lg border-gray-200 shadow-sm md:gap-y-12 md:border md:bg-white md:p-24 md:px-16 dark:border-gray-800">
						{/* Top Section */}
						<div className="flex flex-col">
							<div
								className={twMerge(
									"flex flex-col gap-y-8 ",
									decoration &&
										"border-t border-dashed border-gray-200 pt-4 dark:border-gray-700",
								)}
							>
								{decoration && (
									<p className="dark:text-polar-500 font-mono text-sm uppercase tracking-widest text-gray-500">
										Resources
									</p>
								)}
								<h1 className="text-balance text-5xl !leading-tight md:text-6xl">
									{title}
								</h1>
							</div>
						</div>
						{toc && (
							<div className="divide-y divide-gray-200 dark:divide-gray-700">
								{toc.map((item) => (
									<button
										key={item.id}
										onClick={() => scrollToSection(item.id)}
										className="dark:hover:bg-polar-800 flex w-full cursor-pointer items-center gap-3 p-3 transition-colors duration-200 hover:bg-gray-100"
									>
										<ArrowDownwardOutlined fontSize="inherit" />
										<span>{item.title}</span>
									</button>
								))}
							</div>
						)}
						<div className="flex flex-col gap-y-12">{children}</div>
					</div>
				</div>
			</main>
		</div>
	);
};

export const ResourceSection = ({
	id,
	title,
	children,
}: PropsWithChildren<{
	id: string;
	title: string;
}>) => {
	return (
		<section id={id} className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-8">
			<div className="sticky top-0 col-span-1 flex h-fit flex-col border-gray-200 pt-4 text-lg md:border-t md:text-base dark:border-gray-700">
				<h2>{title}</h2>
			</div>
			<div className="col-span-2 flex flex-col gap-y-4 border-t border-gray-200 pt-4 dark:border-gray-700">
				{children}
			</div>
		</section>
	);
};
