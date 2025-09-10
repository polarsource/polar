"use client";

import { TopbarNavigation } from "@/components/Landing/TopbarNavigation";
import { BrandingMenu } from "@/components/Layout/Public/BrandingMenu";
import Footer from "@/components/Organization/Footer";
import { usePostHog } from "@/hooks/posthog";
import Button from "@polar-sh/ui/components/atoms/Button";
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
	SidebarProvider,
	SidebarTrigger,
	useSidebar,
} from "@polar-sh/ui/components/atoms/Sidebar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@polar-sh/ui/components/ui/popover";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ComponentProps, PropsWithChildren, useState } from "react";
import { twMerge } from "tailwind-merge";
import { AuthModal } from "../Auth/AuthModal";
import { Modal } from "../Modal";
import { useModal } from "../Modal/useModal";

export default function Layout({ children }: PropsWithChildren) {
	return (
		<div className="dark:bg-polar-950 relative flex flex-col bg-gray-50 md:w-full md:flex-1 md:items-center">
			<div className="flex flex-col gap-y-2 md:w-full">
				<LandingPageDesktopNavigation />
				<SidebarProvider className="flex flex-col items-start md:hidden absolute inset-0">
					<LandingPageTopbar />
					<LandingPageMobileNavigation />
				</SidebarProvider>

				<div className="dark:bg-polar-950 relative flex flex-col px-4 md:w-full md:px-0 pt-32 md:pt-0">
					{children}
				</div>
				<LandingPageFooter />
			</div>
		</div>
	);
}

const NavLink = ({
	href,
	className,
	children,
	isActive: _isActive,
	target,
	...props
}: ComponentProps<typeof Link> & {
	isActive?: (pathname: string) => boolean;
}) => {
	const pathname = usePathname();
	const isActive = _isActive
		? _isActive(pathname)
		: pathname.startsWith(href.toString());
	const isExternal = href.toString().startsWith("http");

	return (
		<Link
			href={href}
			target={isExternal ? "_blank" : target}
			prefetch
			className={twMerge(
				"dark:text-polar-500 flex items-center gap-x-2 text-gray-500 transition-colors hover:text-black dark:hover:text-white",
				isActive && "text-black dark:text-white",
				className,
			)}
			{...props}
		>
			{children}
		</Link>
	);
};

interface NavigationItem {
	title: string;
	href: string;
	isActive?: (pathname: string) => boolean;
	target?: "_blank";
}

const mobileNavigationItems: NavigationItem[] = [
	{
		title: "Overview",
		href: "/",
		isActive: (pathname) => pathname === "/",
	},
	{
		title: "Documentation",
		href: "https://docs.polar.sh",
		target: "_blank",
	},
	{
		title: "Resources",
		href: "/resources",
	},
	{
		title: "Company",
		href: "/company",
	},
	{
		title: "Careers",
		href: "/careers",
	},
	{
		title: "Blog",
		href: "/blog",
	},
	{
		title: "Open Source",
		href: "https://github.com/polarsource",
		target: "_blank",
	},
	{
		title: "Polar on X",
		href: "https://x.com/polar_sh",
		target: "_blank",
	},
];

const LandingPageMobileNavigation = () => {
	const sidebar = useSidebar();

	const posthog = usePostHog();
	const {
		isShown: isModalShown,
		hide: hideModal,
		show: showModal,
	} = useModal();

	const onLoginClick = () => {
		posthog.capture("global:user:login:click");
		showModal();
	};

	return (
		<Sidebar className="md:hidden">
			<SidebarHeader className="p-4">
				<BrandingMenu logoVariant="icon" />
			</SidebarHeader>
			<SidebarContent className="px-6 py-2 flex flex-col gap-y-6">
				<div className="flex flex-col gap-y-1">
					{mobileNavigationItems.map((item) => {
						return (
							<NavLink
								key={item.title}
								className="text-xl tracking-tight"
								isActive={item.isActive}
								target={item.target}
								href={item.href}
								onClick={sidebar.toggleSidebar}
							>
								{item.title}
							</NavLink>
						);
					})}
				</div>
				<NavLink
					href="#"
					onClick={onLoginClick}
					className="text-xl tracking-tight"
				>
					Login
				</NavLink>
			</SidebarContent>
			<Modal
				isShown={isModalShown}
				hide={hideModal}
				modalContent={<AuthModal />}
				className="lg:w-full lg:max-w-[480px]"
			/>
		</Sidebar>
	);
};

const LandingPageDesktopNavigation = () => {
	const posthog = usePostHog();
	const {
		isShown: isModalShown,
		hide: hideModal,
		show: showModal,
	} = useModal();
	const [isResourcesOpen, setIsResourcesOpen] = useState(false);
	const pathname = usePathname();

	const onLoginClick = () => {
		posthog.capture("global:user:login:click");
		showModal();
	};

	return (
		<div className="dark:text-polar-50 hidden w-full flex-col items-center gap-12 py-8 md:flex md:px-8">
			<div className="relative flex w-full flex-row items-center justify-between">
				<BrandingMenu logoVariant="icon" size={40} />

				<ul className="absolute left-1/2 mx-auto flex -translate-x-1/2 flex-row gap-x-8 font-medium">
					<li>
						<NavLink href="/" isActive={(pathname) => pathname === "/"}>
							Features
						</NavLink>
					</li>
					<li>
						<Popover open={isResourcesOpen} onOpenChange={setIsResourcesOpen}>
							<PopoverTrigger
								className={twMerge(
									"dark:text-polar-500 flex items-center gap-x-2 text-gray-500 transition-colors hover:text-black focus:outline-none dark:hover:text-white",
									(isResourcesOpen || pathname.includes("/resources")) &&
										"text-black dark:text-white",
								)}
								onMouseEnter={() => setIsResourcesOpen(true)}
								onMouseLeave={() => setIsResourcesOpen(false)}
							>
								Resources
							</PopoverTrigger>
							<PopoverContent
								className="grid w-fit grid-cols-3 divide-x p-0"
								onMouseEnter={() => setIsResourcesOpen(true)}
								onMouseLeave={() => setIsResourcesOpen(false)}
							>
								<div className="flex flex-col p-2">
									<h3 className="dark:text-polar-500 px-4 py-2 text-sm text-gray-500">
										Polar Software Inc.
									</h3>
									<div>
										{[
											{
												href: "/company",
												label: "Company",
												subtitle: "Who we are",
											},
											{
												href: "/careers",
												label: "Careers",
												subtitle: "We're hiring",
											},
											{
												href: "https://polar.sh/assets/brand/polar_brand.zip",
												target: "_blank",
												label: "Brand Assets",
												subtitle: "Logotype & Graphics",
											},
										].map(({ href, label, subtitle, target }) => (
											<Link
												key={href}
												href={href}
												prefetch
												target={target}
												className="dark:hover:bg-polar-800 flex w-48 flex-col rounded-md px-4 py-2 text-sm transition-colors hover:bg-gray-100"
											>
												<span className="font-medium">{label}</span>
												<span className="dark:text-polar-500 text-gray-500">
													{subtitle}
												</span>
											</Link>
										))}
									</div>
								</div>
								<div className="col-span-2 flex flex-col p-2">
									<h3 className="dark:text-polar-500 px-4 py-2 text-sm text-gray-500">
										Platform
									</h3>
									<div className="grid grid-cols-2">
										{[
											{
												href: "https://docs.polar.sh",
												label: "Documentation",
												target: "_blank",
												subtitle: "Get up to speed",
											},
											{
												href: "/resources/why",
												label: "Why Polar",
												subtitle: "Migrate to Polar today",
											},
											{
												href: "/resources/pricing",
												label: "Pricing",
												subtitle: "Cheap and fair pricing",
											},
											{
												href: "https://github.com/polarsource",
												target: "_blank",
												label: "Open Source",
												subtitle: "Star our projects",
											},
											{
												href: "https://status.polar.sh",
												label: "Status",
												subtitle: "API Service Status",
												target: "_blank",
											},
											{
												href: "https://x.com/polar_sh",
												label: "X",
												subtitle: "Join the conversation",
												target: "_blank",
											},
										].map(({ href, label, subtitle, target }) => (
											<Link
												key={href}
												href={href}
												prefetch
												target={target}
												className="dark:hover:bg-polar-800 flex w-48 flex-col rounded-md px-4 py-2 text-sm transition-colors hover:bg-gray-100"
											>
												<span className="font-medium">{label}</span>
												<span className="dark:text-polar-500 text-gray-500">
													{subtitle}
												</span>
											</Link>
										))}
									</div>
								</div>
							</PopoverContent>
						</Popover>
					</li>
					<li>
						<NavLink href="/company">Company</NavLink>
					</li>
					<li>
						<NavLink href="/blog">Blog</NavLink>
					</li>
				</ul>

				<Button onClick={onLoginClick} variant="ghost" className="rounded-full">
					Log In
				</Button>
			</div>
			<Modal
				isShown={isModalShown}
				hide={hideModal}
				modalContent={<AuthModal />}
				className="lg:w-full lg:max-w-[480px]"
			/>
		</div>
	);
};

const LandingPageTopbar = () => {
	return (
		<div className="z-30 flex w-full flex-row items-center justify-between px-6 py-6 md:hidden md:px-12">
			<TopbarNavigation />
			<BrandingMenu
				className="ml-2 mt-1 md:hidden"
				logoVariant="logotype"
				size={100}
			/>
			<SidebarTrigger className="md:hidden" />
		</div>
	);
};

const LandingPageFooter = () => {
	return (
		<motion.div
			initial="initial"
			className="flex w-full flex-col items-center"
			variants={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
			transition={{ duration: 0.5, ease: "easeInOut" }}
			whileInView="animate"
			viewport={{ once: true }}
		>
			<Footer />
		</motion.div>
	);
};
