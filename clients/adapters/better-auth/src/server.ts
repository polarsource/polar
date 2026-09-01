import type { BetterAuthPlugin } from "better-auth";
import {
	onAfterUserCreate,
	onBeforeUserCreate,
	onBeforeUserDelete,
	onUserDelete,
	onUserUpdate,
} from "./hooks/customer";
import { installOrganizationHooks } from "./organization/hooks";
import { createOrganizationLifecycleHooks } from "./organization/lifecycle";
import type { PolarEndpoints, PolarOptions } from "./types";

export const polar = <O extends PolarOptions>(options: O) => {
	const plugins = options.use
		.map((use) => use(options.client, options))
		.reduce((acc, plugin) => {
			Object.assign(acc, plugin);
			return acc;
		}, {} as PolarEndpoints);

	return {
		id: "polar",
		endpoints: {
			...plugins,
		},
		hooks: createOrganizationLifecycleHooks(options),
		init(ctx) {
			installOrganizationHooks(ctx, options);

			return {
				options: {
					databaseHooks: {
						user: {
							create: {
								before: onBeforeUserCreate(options),
								after: onAfterUserCreate(options),
							},
							update: {
								after: onUserUpdate(options, ctx),
							},
							delete: {
								before: onBeforeUserDelete(options, ctx),
								after: onUserDelete(options),
							},
						},
					},
				},
			};
		},
	} satisfies BetterAuthPlugin;
};
