import type { Polar } from "@polar-sh/sdk";
import type { AuthContext, BetterAuthPlugin, User } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type {
	Member,
	OrganizationOptions,
} from "better-auth/plugins/organization";
import * as z from "zod/v4";
import type { PolarOptions } from "../types";
import { getBetterAuthCreatorRole, hasBetterAuthCreatorRole } from "./roles";
import { synchronizeOrganizationSeats } from "./seats";
import {
	PolarOrganizationOwnerInvariantError,
	byEarliestMembership,
	isTeamCustomerSynchronized,
	promoteMemberMirrorToOwner,
	removeMemberMirror,
	updateMemberMirror,
} from "./sync";
import type {
	PolarOrganizationOptions,
	PolarOrganizationRoleSyncOptions,
} from "./types";

export const ORGANIZATION_LEAVE_PATH = "/organization/leave";

type BetterAuthMember = Member & Record<string, unknown>;
type BetterAuthUser = User & Record<string, unknown>;

export interface OrganizationMemberState extends BetterAuthMember {
	user: BetterAuthUser;
}

export class BetterAuthOrganizationStateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BetterAuthOrganizationStateError";
	}
}

const OWNER_CANDIDATE_PAGE_SIZE = 100;
const ORGANIZATION_SYNC_CONCURRENCY = 5;

/**
 * Run every synchronization while limiting the number of organizations that
 * can issue Polar requests at once. Like Promise.allSettled, a failure does not
 * prevent the remaining synchronizations from being attempted.
 */
const synchronizeWithConcurrency = async <T>(
	items: readonly T[],
	synchronize: (item: T) => Promise<void>,
): Promise<void> => {
	let nextIndex = 0;
	let firstRejection: { index: number; reason: unknown } | undefined;

	const worker = async () => {
		while (nextIndex < items.length) {
			const index = nextIndex++;
			try {
				await synchronize(items[index] as T);
			} catch (reason) {
				if (!firstRejection || index < firstRejection.index) {
					firstRejection = { index, reason };
				}
			}
		}
	};

	await Promise.all(
		Array.from(
			{ length: Math.min(ORGANIZATION_SYNC_CONCURRENCY, items.length) },
			worker,
		),
	);

	if (firstRejection) {
		throw firstRejection.reason;
	}
};

export const findEarliestBetterAuthOwnerCandidate = async (
	authContext: AuthContext,
	organizationId: string,
	creatorRole: string,
	excludedUserId: string,
): Promise<OrganizationMemberState | null> => {
	for (let offset = 0; ; offset += OWNER_CANDIDATE_PAGE_SIZE) {
		const members = await authContext.adapter.findMany<BetterAuthMember>({
			model: "member",
			where: [
				{ field: "organizationId", value: organizationId },
				{ field: "userId", value: excludedUserId, operator: "ne" },
				{ field: "role", value: creatorRole, operator: "contains" },
			],
			sortBy: { field: "createdAt", direction: "asc" },
			limit: OWNER_CANDIDATE_PAGE_SIZE,
			offset,
		});

		const successor = members
			.filter((member) => hasBetterAuthCreatorRole(member.role, creatorRole))
			.sort(byEarliestMembership)[0];

		if (successor) {
			const users = await authContext.adapter.findMany<BetterAuthUser>({
				model: "user",
				where: [
					{
						field: "id",
						operator: "in",
						value: [successor.userId],
					},
				],
				limit: 1,
			});
			const user = users[0];
			if (!user) {
				throw new BetterAuthOrganizationStateError(
					`Better Auth user "${successor.userId}" for organization "${organizationId}" was not found`,
				);
			}
			return { ...successor, user };
		}

		if (members.length < OWNER_CANDIDATE_PAGE_SIZE) {
			return null;
		}
	}
};

export const listBetterAuthMembershipsForUser = (
	authContext: AuthContext,
	userId: string,
) =>
	authContext.adapter.findMany<BetterAuthMember>({
		model: "member",
		where: [{ field: "userId", value: userId }],
	});

export const synchronizeUserOrganizationProfiles = async (
	authContext: AuthContext,
	client: Polar,
	user: User,
	organizationOptions: PolarOrganizationOptions,
) => {
	const memberships = await listBetterAuthMembershipsForUser(
		authContext,
		user.id,
	);

	await synchronizeWithConcurrency(memberships, async (membership) => {
		if (
			!(await isTeamCustomerSynchronized(client, membership.organizationId))
		) {
			return;
		}
		await updateMemberMirror(client, {
			organizationId: membership.organizationId,
			user,
		});

		await synchronizeOrganizationSeats({
			authContext,
			client,
			organizationId: membership.organizationId,
			organizationOptions,
		});
	});
};

/**
 * Shared removal primitive for self-leave and user deletion. The organization
 * hook composer can call this same helper for any future bypass path.
 */
export const removeOrganizationMemberMirror = async (input: {
	authContext: AuthContext;
	client: Polar;
	organizationId: string;
	userId: string;
	role: string;
	roleOptions?: PolarOrganizationRoleSyncOptions;
	organizationOptions: PolarOrganizationOptions;
	betterAuthOrganizationOptions?: OrganizationOptions;
}) => {
	if (!(await isTeamCustomerSynchronized(input.client, input.organizationId))) {
		return;
	}
	const creatorRole =
		input.roleOptions?.creatorRole ??
		getBetterAuthCreatorRole(input.authContext);

	let successorExternalMemberId: string | undefined;
	if (hasBetterAuthCreatorRole(input.role, creatorRole)) {
		const successor = await findEarliestBetterAuthOwnerCandidate(
			input.authContext,
			input.organizationId,
			creatorRole,
			input.userId,
		);
		if (!successor) {
			throw new PolarOrganizationOwnerInvariantError(
				input.organizationId,
				`Better Auth has no member with creator role "${creatorRole}"`,
			);
		}
		successorExternalMemberId = successor.userId;
	}

	if (successorExternalMemberId) {
		await promoteMemberMirrorToOwner(input.client, {
			organizationId: input.organizationId,
			externalMemberId: successorExternalMemberId,
		});
	}

	await synchronizeOrganizationSeats({
		authContext: input.authContext,
		client: input.client,
		organizationId: input.organizationId,
		organizationOptions: input.organizationOptions,
		betterAuthOrganizationOptions: input.betterAuthOrganizationOptions,
		excludedUserId: input.userId,
	});

	await removeMemberMirror(input.client, {
		organizationId: input.organizationId,
		externalMemberId: input.userId,
	});
};

const getEndpointResult = async (returned: unknown): Promise<unknown> => {
	if (returned instanceof APIError) {
		return null;
	}
	if (returned instanceof Response) {
		if (!returned.ok) {
			return null;
		}
		return returned.clone().json();
	}
	return returned;
};

const leaveMembershipSchema = z.object({
	organizationId: z.string(),
	userId: z.string(),
	role: z.string(),
});

const readLeaveMembership = async (returned: unknown) => {
	const value = await getEndpointResult(returned);

	if (value === null || value === undefined) {
		return null;
	}

	const result = leaveMembershipSchema.safeParse(value);

	if (!result.success) {
		throw new BetterAuthOrganizationStateError(
			"Better Auth organization leave returned no deleted membership",
		);
	}

	return result.data;
};

export const synchronizeOrganizationLeave = async (
	options: PolarOptions,
	context: { context: AuthContext & { returned?: unknown } },
) => {
	const membership = await readLeaveMembership(context.context["returned"]);

	if (!membership) {
		return;
	}
	const organizationOptions = options.experimental_organizationSync;
	if (!organizationOptions?.enabled) {
		return;
	}

	await removeOrganizationMemberMirror({
		authContext: context.context,
		client: options.client,
		...membership,
		roleOptions: {
			mapBetterAuthRoleToPolarRole:
				organizationOptions.mapBetterAuthRoleToPolarRole,
		},
		organizationOptions,
	});
};

export const createOrganizationLifecycleHooks = (
	options: PolarOptions,
): BetterAuthPlugin["hooks"] | undefined => {
	if (!options.experimental_organizationSync?.enabled) {
		return undefined;
	}
	return {
		after: [
			{
				matcher: (context) => context.path === ORGANIZATION_LEAVE_PATH,
				handler: createAuthMiddleware(async (context) => {
					await synchronizeOrganizationLeave(options, context);
				}),
			},
		],
	};
};

export const synchronizeUserDeletionMemberships = async (
	authContext: AuthContext,
	client: Polar,
	user: User,
	options: PolarOrganizationOptions,
) => {
	const memberships = await listBetterAuthMembershipsForUser(
		authContext,
		user.id,
	);

	await synchronizeWithConcurrency(memberships, (membership) =>
		removeOrganizationMemberMirror({
			authContext,
			client,
			organizationId: membership.organizationId,
			userId: user.id,
			role: membership.role,
			roleOptions: {
				mapBetterAuthRoleToPolarRole: options.mapBetterAuthRoleToPolarRole,
			},
			organizationOptions: options,
		}),
	);
};
