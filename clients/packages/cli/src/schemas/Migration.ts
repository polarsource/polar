import { Schema } from "effect";

export const MigrationOrigin = Schema.String.pipe(
	Schema.brand("MigrationOrigin"),
);
export type MigrationOrigin = typeof MigrationOrigin.Type;

export const MigrationDestination = Schema.String.pipe(
	Schema.brand("MigrationDestination"),
);
export type MigrationDestination = typeof MigrationDestination.Type;

export const MigrationContext = Schema.Struct({
	from: MigrationOrigin,
	to: MigrationDestination,
});
export type MigrationContext = typeof MigrationContext.Type;
