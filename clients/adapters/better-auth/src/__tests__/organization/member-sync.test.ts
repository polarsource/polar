import type { Member as PolarMember } from "@polar-sh/sdk/models/components/member.js";
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	PolarOrganizationOwnerInvariantError,
	ensureMemberMirror,
	promoteMemberMirrorToOwner,
	removeMemberMirror,
	updateMemberRoleMirror,
} from "../../organization/sync";
import type { BetterAuthOrganizationMemberMirror } from "../../organization/types";
import { createMockPolarClient } from "../utils/mocks";

const organizationId = "organization-123";
const createdAt = new Date("2025-01-01T00:00:00.000Z");

const notFound = (resource = "Resource") =>
	new ResourceNotFound(
		{ error: "ResourceNotFound", detail: `${resource} not found` },
		{
			response: new Response("", { status: 404 }),
			request: new Request("https://api.polar.sh/v1/customers"),
			body: "",
		},
	);

const betterAuthMember = (
	userId: string,
	role: string,
	overrides: Partial<BetterAuthOrganizationMemberMirror> = {},
): BetterAuthOrganizationMemberMirror => ({
	id: `membership-${userId}`,
	organizationId,
	userId,
	role,
	createdAt,
	user: {
		id: userId,
		email: `${userId}@example.com`,
		name: userId,
	},
	...overrides,
});

const polarMember = (
	userId: string,
	role: PolarMember["role"],
	overrides: Partial<PolarMember> = {},
): PolarMember => ({
	id: `polar-member-${userId}`,
	createdAt,
	modifiedAt: null,
	customerId: `customer-${organizationId}`,
	email: `${userId}@example.com`,
	name: userId,
	externalId: userId,
	role,
	...overrides,
});

const createHarness = (
	initialMembers: Record<string, readonly PolarMember[]>,
) => {
	const client = createMockPolarClient();
	const members = new Map<string, PolarMember>();
	for (const [orgId, organizationMembers] of Object.entries(initialMembers)) {
		for (const member of organizationMembers) {
			members.set(`${orgId}:${member.externalId}`, member);
		}
	}

	vi.mocked(client.customers.getExternal).mockImplementation(
		async ({ externalId }) => ({
			id: `customer-${externalId}`,
			createdAt,
			modifiedAt: null,
			metadata: {},
			externalId,
			email: null,
			emailVerified: false,
			type: "team",
			name: "Acme",
			billingName: null,
			billingAddress: null,
			taxId: null,
			organizationId: "polar-organization",
			deletedAt: null,
			avatarUrl: null,
		}),
	);
	vi.mocked(client.members.listMembers).mockImplementation(
		async ({ externalCustomerId, role }) => ({
			result: {
				items: [...members.entries()]
					.filter(
						([key, member]) =>
							key.startsWith(`${externalCustomerId}:`) &&
							(!role || member.role === role),
					)
					.map(([, member]) => member),
				pagination: {
					totalCount: members.size,
					maxPage: 1,
				},
			},
			next: vi.fn(),
			async *[Symbol.asyncIterator]() {},
		}),
	);
	vi.mocked(client.customers.members.getExternal).mockImplementation(
		async ({ externalId, memberExternalId }) => {
			const member = members.get(`${externalId}:${memberExternalId}`);
			if (!member) throw notFound("Member");
			return member;
		},
	);
	vi.mocked(client.customers.members.createExternal).mockImplementation(
		async ({ externalId, memberCreateFromCustomer }) => {
			const existingByEmail = [...members.entries()].find(
				([key, member]) =>
					key.startsWith(`${externalId}:`) &&
					member.email.toLowerCase() ===
						memberCreateFromCustomer.email.toLowerCase(),
			)?.[1];
			if (existingByEmail) return existingByEmail;

			const member = polarMember(
				memberCreateFromCustomer.externalId ?? "missing-external-id",
				memberCreateFromCustomer.role ?? "member",
				{
					customerId: `customer-${externalId}`,
					email: memberCreateFromCustomer.email,
					name: memberCreateFromCustomer.name ?? null,
					externalId: memberCreateFromCustomer.externalId ?? null,
				},
			);
			members.set(`${externalId}:${member.externalId}`, member);
			return member;
		},
	);
	vi.mocked(client.customers.members.updateExternal).mockImplementation(
		async ({ externalId, memberExternalId, memberUpdate }) => {
			const key = `${externalId}:${memberExternalId}`;
			const existing = members.get(key);
			if (!existing) throw notFound("Member");
			if (memberUpdate.role === "owner") {
				for (const [otherKey, other] of members) {
					if (otherKey.startsWith(`${externalId}:`) && other.role === "owner") {
						members.set(otherKey, { ...other, role: "billing_manager" });
					}
				}
			}
			const updated: PolarMember = {
				...existing,
				name:
					memberUpdate.name === undefined ? existing.name : memberUpdate.name,
				email: memberUpdate.email ?? existing.email,
				role: memberUpdate.role ?? existing.role,
				modifiedAt: new Date(),
			};
			members.set(key, updated);
			return updated;
		},
	);
	vi.mocked(client.customers.members.deleteExternal).mockImplementation(
		async ({ externalId, memberExternalId }) => {
			const key = `${externalId}:${memberExternalId}`;
			if (!members.delete(key)) throw notFound("Member");
		},
	);

	return {
		client,
		members,
	};
};

describe("organization member and owner synchronization", () => {
	beforeEach(() => vi.clearAllMocks());

	it("fails when the team customer is missing", async () => {
		const harness = createHarness({});
		vi.mocked(harness.client.customers.getExternal).mockRejectedValue(
			notFound("Customer"),
		);
		const member = betterAuthMember("member", "member");

		await expect(
			ensureMemberMirror(
				harness.client,
				{},
				{
					organizationId,
					user: member.user,
					betterAuthRole: member.role,
				},
			),
		).rejects.toThrow(
			'Polar team customer with external ID "organization-123" was not found',
		);
	});

	it("creates an admin as a billing manager without duplicating it on retry", async () => {
		const owner = betterAuthMember("owner", "owner");
		const admin = betterAuthMember("admin", "member, admin");
		const harness = createHarness({
			[organizationId]: [polarMember("owner", "owner")],
		});

		const input = {
			organizationId,
			user: admin.user,
			betterAuthRole: admin.role,
		};
		await ensureMemberMirror(harness.client, {}, input);
		await ensureMemberMirror(harness.client, {}, input);

		expect(harness.members.get(`${organizationId}:admin`)?.role).toBe(
			"billing_manager",
		);
		expect(
			harness.client.customers.members.createExternal,
		).toHaveBeenCalledOnce();
	});

	it("scopes one Better Auth user to each Polar team customer", async () => {
		const secondOrganizationId = "organization-456";
		const shared = betterAuthMember("shared-user", "member");
		const firstOwner = betterAuthMember("first-owner", "owner");
		const secondOwner = betterAuthMember("second-owner", "owner", {
			organizationId: secondOrganizationId,
		});
		const harness = createHarness({
			[organizationId]: [polarMember("first-owner", "owner")],
			[secondOrganizationId]: [
				polarMember("second-owner", "owner", {
					customerId: `customer-${secondOrganizationId}`,
				}),
			],
		});

		await ensureMemberMirror(
			harness.client,
			{},
			{
				organizationId,
				user: shared.user,
				betterAuthRole: shared.role,
			},
		);
		await ensureMemberMirror(
			harness.client,
			{},
			{
				organizationId: secondOrganizationId,
				user: shared.user,
				betterAuthRole: shared.role,
			},
		);

		expect(harness.members.has(`${organizationId}:shared-user`)).toBe(true);
		expect(harness.members.has(`${secondOrganizationId}:shared-user`)).toBe(
			true,
		);
	});

	it("does not let a second Better Auth owner steal current ownership", async () => {
		const firstOwner = betterAuthMember("first-owner", "owner");
		const secondOwner = betterAuthMember("second-owner", "owner", {
			createdAt: new Date("2024-01-01T00:00:00.000Z"),
		});
		const harness = createHarness({
			[organizationId]: [
				polarMember("first-owner", "owner"),
				polarMember("second-owner", "billing_manager"),
			],
		});

		await updateMemberRoleMirror(
			harness.client,
			{},
			{
				organizationId,
				user: secondOwner.user,
				betterAuthRole: secondOwner.role,
				members: [firstOwner, secondOwner],
			},
		);

		expect(harness.members.get(`${organizationId}:first-owner`)?.role).toBe(
			"owner",
		);
		expect(harness.members.get(`${organizationId}:second-owner`)?.role).toBe(
			"billing_manager",
		);
	});

	it("transfers ownership without updating unrelated members", async () => {
		const oldOwner = betterAuthMember("old-owner", "member");
		const successor = betterAuthMember("successor", "owner");
		const unrelated = betterAuthMember("unrelated", "admin");
		const harness = createHarness({
			[organizationId]: [
				polarMember("old-owner", "owner"),
				polarMember("successor", "billing_manager"),
				polarMember("unrelated", "member", { name: "Existing Polar name" }),
			],
		});

		await updateMemberRoleMirror(
			harness.client,
			{},
			{
				organizationId,
				user: oldOwner.user,
				betterAuthRole: oldOwner.role,
				members: [oldOwner, successor, unrelated],
			},
		);
		expect(harness.members.get(`${organizationId}:successor`)?.role).toBe(
			"owner",
		);
		expect(harness.members.get(`${organizationId}:old-owner`)?.role).toBe(
			"member",
		);
		expect(harness.members.get(`${organizationId}:unrelated`)).toMatchObject({
			name: "Existing Polar name",
			role: "member",
		});
		expect(
			vi
				.mocked(harness.client.customers.members.updateExternal)
				.mock.calls.some(
					([call]) => call.memberExternalId === unrelated.userId,
				),
		).toBe(false);
	});

	it("promotes a successor before deleting the departing owner", async () => {
		const successor = betterAuthMember("successor", "owner");
		const harness = createHarness({
			[organizationId]: [
				polarMember("departing", "owner"),
				polarMember("successor", "billing_manager"),
			],
		});

		await promoteMemberMirrorToOwner(harness.client, {
			organizationId,
			externalMemberId: successor.userId,
		});
		await removeMemberMirror(harness.client, {
			organizationId,
			externalMemberId: "departing",
		});

		const promotion = vi
			.mocked(harness.client.customers.members.updateExternal)
			.mock.calls.findIndex(([call]) => call.memberUpdate.role === "owner");
		expect(promotion).toBeGreaterThanOrEqual(0);
		expect(
			vi.mocked(harness.client.customers.members.updateExternal).mock
				.invocationCallOrder[promotion],
		).toBeLessThan(
			vi.mocked(harness.client.customers.members.deleteExternal).mock
				.invocationCallOrder[0] ?? 0,
		);
		expect(harness.members.has(`${organizationId}:departing`)).toBe(false);
	});

	it("removes a non-owner directly", async () => {
		const harness = createHarness({
			[organizationId]: [
				polarMember("owner", "owner"),
				polarMember("member", "member"),
			],
		});

		await expect(
			removeMemberMirror(harness.client, {
				organizationId,
				externalMemberId: "member",
			}),
		).resolves.toBeUndefined();
	});

	it("removes a non-owner idempotently and propagates other deletion failures", async () => {
		const harness = createHarness({
			[organizationId]: [
				polarMember("owner", "owner"),
				polarMember("member", "member"),
			],
		});
		const remove = (externalMemberId: string) =>
			removeMemberMirror(harness.client, {
				organizationId,
				externalMemberId,
			});

		await expect(remove("member")).resolves.toBeUndefined();
		await expect(remove("member")).resolves.toBeUndefined();

		const failure = new Error("Forbidden");
		vi.mocked(
			harness.client.customers.members.deleteExternal,
		).mockRejectedValueOnce(failure);
		await expect(remove("another-member")).rejects.toBe(failure);
	});

	it("refuses to demote the last Better Auth owner", async () => {
		const harness = createHarness({
			[organizationId]: [polarMember("owner", "owner")],
		});

		await expect(
			updateMemberRoleMirror(
				harness.client,
				{},
				{
					organizationId,
					user: betterAuthMember("owner", "member").user,
					betterAuthRole: "member",
					members: [betterAuthMember("owner", "member")],
				},
			),
		).rejects.toBeInstanceOf(PolarOrganizationOwnerInvariantError);
	});

	it("uses custom role mapping for a non-owner member", async () => {
		const owner = betterAuthMember("owner", "owner");
		const finance = betterAuthMember("finance", "finance, support");
		const harness = createHarness({
			[organizationId]: [
				polarMember("owner", "owner"),
				polarMember("finance", "member"),
			],
		});
		const mapBetterAuthRoleToPolarRole = vi
			.fn()
			.mockReturnValue("billing_manager");

		await updateMemberRoleMirror(
			harness.client,
			{ mapBetterAuthRoleToPolarRole },
			{
				organizationId,
				user: finance.user,
				betterAuthRole: finance.role,
				members: [owner, finance],
			},
		);

		expect(mapBetterAuthRoleToPolarRole).toHaveBeenCalledOnce();
		expect(mapBetterAuthRoleToPolarRole).toHaveBeenCalledWith({
			role: "finance, support",
			roles: new Set(["finance", "support"]),
			organizationId,
			user: finance.user,
		});
		expect(harness.members.get(`${organizationId}:finance`)?.role).toBe(
			"billing_manager",
		);
	});
});
