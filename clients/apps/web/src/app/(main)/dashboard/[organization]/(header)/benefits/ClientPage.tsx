"use client";

import { BenefitPage } from "@/components/Benefit/BenefitPage";
import CreateBenefitModalContent from "@/components/Benefit/CreateBenefitModalContent";
import { LicenseKeysPage } from "@/components/Benefit/LicenseKeysPage";
import UpdateBenefitModalContent from "@/components/Benefit/UpdateBenefitModalContent";
import {
	benefitsDisplayNames,
	resolveBenefitIcon,
} from "@/components/Benefit/utils";
import { DashboardBody } from "@/components/Layout/DashboardLayout";
import { ConfirmModal } from "@/components/Modal/ConfirmModal";
import { InlineModal } from "@/components/Modal/InlineModal";
import { useModal } from "@/components/Modal/useModal";
import Spinner from "@/components/Shared/Spinner";
import { useToast } from "@/components/Toast/use-toast";
import { useDeleteBenefit, useInfiniteBenefits } from "@/hooks/queries";
import { useInViewport } from "@/hooks/utils";
import {
	AddOutlined,
	ArrowDownward,
	ArrowUpward,
	MoreVertOutlined,
	Search,
} from "@mui/icons-material";
import { schemas } from "@polar-sh/client";
import Button from "@polar-sh/ui/components/atoms/Button";
import Input from "@polar-sh/ui/components/atoms/Input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@polar-sh/ui/components/ui/dropdown-menu";
import { Separator } from "@polar-sh/ui/components/ui/separator";
import { useSearchParams } from "next/navigation";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo } from "react";
import { twMerge } from "tailwind-merge";

const ClientPage = ({
	organization,
}: {
	organization: schemas["Organization"];
}) => {
	const searchParams = useSearchParams();

	const [sorting, setSorting] = useQueryState(
		"sorting",
		parseAsStringLiteral([
			"-created_at",
			"created_at",
			"description",
			"-description",
		] as const).withDefault("-created_at"),
	);

	const [selectedBenefitId, setSelectedBenefitId] = useQueryState(
		"benefitId",
		parseAsString,
	);
	const [query, setQuery] = useQueryState("query", parseAsString);

	const { data, fetchNextPage, hasNextPage } = useInfiniteBenefits(
		organization.id,
		{
			query: query ?? undefined,
			sorting: [sorting],
		},
	);

	const benefits = useMemo(
		() => data?.pages.flatMap((page) => page.items) ?? [],
		[data?.pages],
	);

	const selectedBenefit = useMemo(() => {
		if (selectedBenefitId) {
			return benefits?.find((benefit) => benefit.id === selectedBenefitId);
		}

		return benefits[0];
	}, [benefits, selectedBenefitId]);

	const {
		isShown: isCreateBenefitModalShown,
		toggle: toggleCreateBenefitModal,
		hide: hideCreateBenefitModal,
	} = useModal(searchParams?.get("create_benefit") === "true");

	useEffect(() => {
		if (!selectedBenefitId) {
			setSelectedBenefitId(benefits[0]?.id ?? null);
		}
	}, [benefits, selectedBenefitId, setSelectedBenefitId]);

	const { ref: loadingRef, inViewport } = useInViewport<HTMLDivElement>();

	useEffect(() => {
		if (inViewport && hasNextPage) {
			fetchNextPage();
		}
	}, [inViewport, hasNextPage, fetchNextPage]);

	const { toast } = useToast();

	const {
		isShown: isEditShown,
		toggle: toggleEdit,
		hide: hideEdit,
	} = useModal();

	const {
		isShown: isDeleteShown,
		hide: hideDelete,
		toggle: toggleDelete,
	} = useModal();

	const deleteBenefit = useDeleteBenefit(organization.id);

	const handleDeleteBenefit = useCallback(() => {
		if (!selectedBenefit) {
			return;
		}

		deleteBenefit.mutateAsync({ id: selectedBenefit.id }).then(({ error }) => {
			if (error) {
				toast({
					title: "Benefit Deletion Failed",
					description: `Error deleting benefit ${selectedBenefit.description}: ${error.detail}`,
				});
				return;
			}
			toast({
				title: "Benefit Deleted",
				description: `Benefit ${selectedBenefit.description} successfully deleted`,
			});
		});
	}, [deleteBenefit, selectedBenefit, toast]);

	const copyBenefitId = async () => {
		if (!selectedBenefit) {
			return;
		}

		try {
			await navigator.clipboard.writeText(selectedBenefit.id);
			toast({
				title: "Benefit ID Copied",
				description: `Benefit ${selectedBenefit.description} ID successfully copied`,
			});
		} catch (err) {
			toast({
				title: "Benefit ID Copy Failed",
				description: `Error copying ID of benefit ${selectedBenefit.description}`,
			});
		}
	};

	return (
		<DashboardBody
			header={
				selectedBenefit ? (
					<div className="flex flex-row items-center gap-4">
						<Button onClick={toggleEdit}>Edit Benefit</Button>
						<DropdownMenu>
							<DropdownMenuTrigger className="focus:outline-none" asChild>
								<Button className="h-10 w-10" variant="secondary">
									<MoreVertOutlined fontSize="inherit" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className="dark:bg-polar-800 bg-gray-50 shadow-lg"
							>
								<DropdownMenuItem onClick={copyBenefitId}>
									Copy ID
								</DropdownMenuItem>
								{selectedBenefit?.deletable && (
									<DropdownMenuItem onClick={toggleDelete}>
										Delete
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				) : (
					<></>
				)
			}
			title={
				selectedBenefit ? (
					<div className="flex flex-row items-center gap-6">
						<span className="dark:bg-polar-700 flex h-12 w-12 shrink-0 flex-row items-center justify-center rounded-full bg-gray-200 text-2xl text-black dark:text-white">
							{resolveBenefitIcon(selectedBenefit.type, "h-4 w-4")}
						</span>
						<div className="flex flex-col">
							<p className="text-lg">
								{(selectedBenefit.description?.length ?? 0) > 0
									? selectedBenefit.description
									: "—"}
							</p>
							<div className="dark:text-polar-500 flex flex-row items-center gap-2 font-mono text-sm text-gray-500">
								<span>{benefitsDisplayNames[selectedBenefit.type]}</span>
							</div>
						</div>
					</div>
				) : undefined
			}
			className="flex flex-col gap-8"
			contextViewPlacement="left"
			contextViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden"
			contextView={
				<div className="dark:divide-polar-800 flex h-full flex-col divide-y divide-gray-200">
					<div className="flex flex-row items-center justify-between gap-6 px-4 py-4">
						<div>Benefits</div>
						<div className="flex flex-row items-center gap-4">
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6"
								onClick={() =>
									setSorting(
										sorting === "-created_at" ? "created_at" : "-created_at",
									)
								}
							>
								{sorting === "created_at" ? (
									<ArrowUpward fontSize="small" />
								) : (
									<ArrowDownward fontSize="small" />
								)}
							</Button>
							<Button
								size="icon"
								className="h-6 w-6"
								onClick={toggleCreateBenefitModal}
							>
								<AddOutlined fontSize="small" />
							</Button>
						</div>
					</div>
					<div className="flex flex-row items-center gap-3 px-4 py-2">
						<div className="dark:bg-polar-800 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
							<Search
								fontSize="inherit"
								className="dark:text-polar-500 text-gray-500"
							/>
						</div>
						<Input
							className="w-full rounded-none border-none bg-transparent p-0 !shadow-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
							placeholder="Search Benefits"
							value={query ?? undefined}
							onChange={(e) => setQuery(e.target.value)}
						/>
					</div>
					<div className="dark:divide-polar-800 flex h-full flex-grow flex-col divide-y divide-gray-50 overflow-y-auto">
						{benefits.map((benefit) => (
							<div
								key={benefit.id}
								onClick={() => setSelectedBenefitId(benefit.id)}
								className={twMerge(
									"dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100",
									selectedBenefit?.id === benefit.id &&
										"dark:bg-polar-800 bg-gray-100",
								)}
							>
								<div className="flex flex-row items-center gap-3 px-4 py-3">
									<span className="dark:bg-polar-700 flex h-6 w-6 shrink-0 flex-row items-center justify-center rounded-full bg-gray-200 text-2xl text-black dark:text-white">
										{resolveBenefitIcon(benefit.type, "h-3 w-3")}
									</span>
									<div className="flex min-w-0 flex-col">
										<div className="w-full truncate text-sm">
											{benefit.description}
										</div>
										<div className="w-full truncate text-xs text-gray-500 dark:text-gray-500">
											{benefitsDisplayNames[benefit.type]}
										</div>
									</div>
								</div>
							</div>
						))}
						{hasNextPage && (
							<div
								ref={loadingRef}
								className="flex w-full items-center justify-center py-8"
							>
								<Spinner />
							</div>
						)}
					</div>
				</div>
			}
			wide
		>
			<Separator className="dark:bg-polar-700" />
			{selectedBenefit ? (
				selectedBenefit.type === "license_keys" ? (
					<LicenseKeysPage
						organization={organization}
						benefit={selectedBenefit}
					/>
				) : (
					<BenefitPage benefit={selectedBenefit} organization={organization} />
				)
			) : (
				<div className="mt-96 flex w-full flex-col items-center justify-center gap-4">
					<h1 className="text-2xl font-normal">No Benefit Selected</h1>
					<p className="dark:text-polar-500 text-gray-500">
						Select a benefit to view its details, or create a new one
					</p>
					<Button onClick={toggleCreateBenefitModal}>Create Benefit</Button>
				</div>
			)}
			<InlineModal
				isShown={isCreateBenefitModalShown}
				hide={hideCreateBenefitModal}
				modalContent={
					<CreateBenefitModalContent
						organization={organization}
						hideModal={hideCreateBenefitModal}
						onSelectBenefit={(benefit) => {
							setSelectedBenefitId(benefit.id);
							hideCreateBenefitModal();
						}}
					/>
				}
			/>
			<InlineModal
				isShown={isEditShown}
				hide={hideEdit}
				modalContent={
					selectedBenefit ? (
						<UpdateBenefitModalContent
							organization={organization}
							benefit={selectedBenefit}
							hideModal={hideEdit}
						/>
					) : (
						<></>
					)
				}
			/>
			<ConfirmModal
				isShown={isDeleteShown}
				hide={hideDelete}
				title="Delete Benefit"
				description="Deleting a benefit will remove it from every Products & revoke it for existing customers. Are you sure?"
				onConfirm={handleDeleteBenefit}
				destructive
			/>
		</DashboardBody>
	);
};

export default ClientPage;
