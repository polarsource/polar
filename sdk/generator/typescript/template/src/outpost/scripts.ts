export const READ_STATES_SCRIPT = `
{{ redis_scripts.outpost.read_states }}`;

export const PREPARE_SNAPSHOT_SCRIPT = `
{{ redis_scripts.outpost.prepare_snapshot }}`;

export const PUSH_TELEMETRY_SCRIPT = `
{{ redis_scripts.outpost.push_telemetry }}`;

export const WRITE_BUCKET_SCRIPT = `
{{ redis_scripts.outpost.write_bucket }}`;

export const COMMIT_PULL_SCRIPT = `
{{ redis_scripts.outpost.commit_pull }}`;

export const APPLY_SNAPSHOT_SCRIPT = `
{{ redis_scripts.outpost.apply_snapshot }}`;

export const CONFIRM_SCRIPT = `
{{ redis_scripts.outpost.confirm }}`;
