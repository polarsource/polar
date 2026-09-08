import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";
import { listen } from "./commands/listen";
import { login } from "./commands/login";
import { logout } from "./commands/logout";
import { migrate } from "./commands/migrate";
import { update } from "./commands/update";
import * as Migration from "./services/migration/migrate";
import * as OAuth from "./services/oauth";
import * as Polar from "./services/polar";
import {
	checkForUpdateInBackground,
	showUpdateNotice,
} from "./services/update-check";
import { VERSION } from "./version";

const mainCommand = Command.make("polar").pipe(
	Command.withSubcommands([login, logout, migrate, listen, update]),
);

const cli = Command.run(mainCommand, {
	version: VERSION.replace(/^v/, ""),
});

const services = Layer.mergeAll(
	OAuth.layer,
	Polar.layer,
	Migration.layer,
	BunServices.layer,
);

showUpdateNotice();
checkForUpdateInBackground();

cli.pipe(Effect.provide(services), BunRuntime.runMain);
