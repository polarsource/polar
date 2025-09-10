"use client";

import GetStartedButton from "@/components/Auth/GetStartedButton";
import Button from "@polar-sh/ui/components/atoms/Button";
import { motion } from "framer-motion";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
export const Hero = ({ className }: { className?: string }) => {
	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.1,
			},
		},
	};

	const itemVariants = {
		hidden: { opacity: 0 },
		visible: { opacity: 1, transition: { duration: 1 } },
	};

	return (
		<motion.div
			className={twMerge(
				"relative flex flex-col items-center justify-center gap-6 px-4 pt-8 text-center md:px-12 md:pt-12",
				className,
			)}
			variants={containerVariants}
			initial="hidden"
			whileInView="visible"
			viewport={{ once: true }}
		>
			<motion.h1
				className="text-balance text-5xl !leading-tight tracking-tight md:px-0 md:text-6xl"
				variants={itemVariants}
			>
				Monetize your software
			</motion.h1>
			<motion.p
				className="dark:text-polar-500 text-balance text-xl !leading-tight text-gray-500 md:px-0"
				variants={itemVariants}
			>
				Turn your software into a business with 6 lines of code
			</motion.p>
			<motion.div
				className="mt-6 flex flex-row items-center gap-x-6"
				variants={itemVariants}
			>
				<GetStartedButton
					size="lg"
					text="Get Started"
					className="rounded-full bg-black font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black"
				/>
				<Link
					href="/resources/why"
					prefetch
					className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
				>
					<Button
						variant="secondary"
						size="lg"
						className="dark:bg-polar-800 rounded-full border-none bg-white"
					>
						Why Polar
					</Button>
				</Link>
			</motion.div>
		</motion.div>
	);
};
