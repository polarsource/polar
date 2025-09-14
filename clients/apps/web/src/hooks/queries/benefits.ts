import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";

import { queryClient } from "@/utils/api/query";
import { api } from "@/utils/client";
import { operations, schemas, unwrap } from "@polar-sh/client";
import { defaultRetry } from "./retry";

const _invalidateBenefitsQueries = ({
	id,
	orgId,
}: {
	id?: string;
	orgId?: string;
}) => {
	if (id) {
		queryClient.invalidateQueries({
			queryKey: ["benefits", "id", id],
		});
	}

	if (orgId) {
		queryClient.invalidateQueries({
			queryKey: ["benefits", "organization", orgId],
		});

		queryClient.invalidateQueries({
			queryKey: ["infinite", "benefits", "organization", orgId],
		});

		queryClient.invalidateQueries({
			queryKey: ["benefits", "grants", id, orgId],
		});
	}

	queryClient.invalidateQueries({
		queryKey: ["subscriptionTiers"],
	});
};

export const useInfiniteBenefits = (
	orgId: string,
	parameters?: operations["benefits:list"]["parameters"]["query"],
) =>
	useInfiniteQuery({
		queryKey: ["infinite", "benefits", "organization", orgId, parameters],
		queryFn: ({ pageParam }) =>
			unwrap(
				api.GET("/v1/benefits/", {
					params: {
						query: {
							...parameters,
							organization_id: orgId,
							page: pageParam,
						},
					},
				}),
			),
		retry: defaultRetry,
		initialPageParam: 1,
		getNextPageParam: (lastPage, _allPages, lastPageParam) => {
			if (
				lastPageParam === lastPage.pagination.max_page ||
				lastPage.items.length === 0
			) {
				return null;
			}

			return lastPageParam + 1;
		},
	});

export const useBenefits = (
	orgId?: string,
	parameters?: operations["benefits:list"]["parameters"]["query"],
) =>
	useQuery({
		queryKey: ["benefits", "organization", orgId, parameters],
		queryFn: () =>
			unwrap(
				api.GET("/v1/benefits/", {
					params: {
						query: {
							...parameters,
							organization_id: orgId,
						},
					},
				}),
			),
		retry: defaultRetry,
		enabled: !!orgId,
	});

export const useBenefit = (id?: string) =>
	useQuery({
		queryKey: ["benefits", "id", id],
		queryFn: () => {
			return unwrap(
				api.GET("/v1/benefits/{id}", {
					params: {
						path: {
							id: id ?? "",
						},
					},
				}),
			);
		},
		retry: defaultRetry,
		enabled: !!id,
	});

export const useUpdateBenefit = (orgId?: string) =>
	useMutation({
		mutationFn: ({
			id,
			body,
		}: {
			id: string;
			body: operations["benefits:update"]["requestBody"]["content"]["application/json"];
		}) => {
			return api.PATCH("/v1/benefits/{id}", {
				params: {
					path: {
						id,
					},
				},
				body,
			});
		},
		onSuccess: (result, _variables, _ctx) => {
			const { data, error } = result;
			if (error) {
				return;
			}
			_invalidateBenefitsQueries({ id: data.id, orgId });
		},
	});

export const useCreateBenefit = (orgId?: string) =>
	useMutation({
		mutationFn: (body: schemas["BenefitCreate"]) => {
			return api.POST("/v1/benefits/", { body });
		},
		onSuccess: (result, _variables, _ctx) => {
			const { data, error } = result;
			if (error) {
				return;
			}
			_invalidateBenefitsQueries({ id: data.id, orgId });
		},
	});

export const useDeleteBenefit = (orgId?: string) =>
	useMutation({
		mutationFn: ({ id }: { id: string }) => {
			return api.DELETE("/v1/benefits/{id}", {
				params: {
					path: {
						id,
					},
				},
			});
		},
		onSuccess: (result, variables, _ctx) => {
			if (result.error) {
				return;
			}
			_invalidateBenefitsQueries({ id: variables.id, orgId });
		},
	});

export const useBenefitGrants = ({
	benefitId,
	organizationId,
	limit = 30,
	page = 1,
}: {
	benefitId: string;
	organizationId: string;
	limit?: number;
	page?: number;
}) =>
	useQuery({
		queryKey: [
			"benefits",
			"grants",
			benefitId,
			organizationId,
			{ page, limit },
		],
		queryFn: () => {
			return unwrap(
				api.GET("/v1/benefits/{id}/grants", {
					params: {
						path: { id: benefitId },
						query: {
							organization_id: organizationId,
							page,
							limit,
						},
					},
				}),
			);
		},
		retry: defaultRetry,
	});

export const useCustomerBenefitGrantsList = ({
	customerId,
	organizationId,
	limit = 30,
	page = 1,
}: {
	customerId: string;
	organizationId: string;
	limit?: number;
	page?: number;
}) =>
	useQuery({
		queryKey: [
			"customer",
			"benefit_grants",
			customerId,
			organizationId,
			{ page, limit },
		],
		queryFn: async () => {
			// We need to get all benefits for the organization first, then get grants for each benefit filtered by customer
			const benefitsResponse = await unwrap(
				api.GET("/v1/benefits/", {
					params: {
						query: {
							organization_id: organizationId,
							limit: 100, // Get all benefits
						},
					},
				}),
			);

			// Collect all grants for this customer across all benefits
			const allGrants: (schemas['BenefitGrant'] & { benefit: schemas['Benefit'] })[] = [];
			
			for (const benefit of benefitsResponse.items) {
				const grantsResponse = await unwrap(
					api.GET("/v1/benefits/{id}/grants", {
						params: {
							path: { id: benefit.id },
							query: {
								customer_id: customerId,
								limit: 1000, // Get all grants for this customer
							},
						},
					}),
				);
				// Add benefit information to each grant
				const grantsWithBenefit = grantsResponse.items.map(grant => ({
					...grant,
					benefit,
				}));
				allGrants.push(...grantsWithBenefit);
			}

			// Sort by created_at descending by default
			const sortedGrants = allGrants.sort((a, b) => 
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
			);

			// Apply pagination
			const startIndex = (page - 1) * limit;
			const endIndex = startIndex + limit;
			const paginatedGrants = sortedGrants.slice(startIndex, endIndex);

			return {
				items: paginatedGrants,
				pagination: {
					total_count: sortedGrants.length,
					max_page: Math.ceil(sortedGrants.length / limit),
				},
			};
		},
		retry: defaultRetry,
	});
