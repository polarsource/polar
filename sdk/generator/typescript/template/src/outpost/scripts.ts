export const READ_STATES_SCRIPT = `
{{ outpost_scripts.read_states }}`;

export const PREPARE_SNAPSHOT_SCRIPT = `
{{ outpost_scripts.prepare_snapshot }}`;

export const PUSH_TELEMETRY_SCRIPT = `
{{ outpost_scripts.push_telemetry }}`;

export const WRITE_BUCKET_SCRIPT = `
{{ outpost_scripts.write_bucket }}`;

export const CONFIRM_SCRIPT = `
{{ outpost_scripts.confirm }}`;

export const OUTBOX_BACKLOG_SCRIPT = `
{{ outpost_scripts.outbox_backlog }}`;

export const RELEASE_LOCK_SCRIPT = `
{{ outpost_scripts.release_lock }}`;

export const EXTEND_LOCK_SCRIPT = `
{{ outpost_scripts.extend_lock }}`;

export const COMMIT_PULL_SCRIPT = `
{{ outpost_scripts.commit_pull }}`;

export const BACKOFF_SCRIPT = `
{{ outpost_scripts.backoff }}`;

export const APPLY_SNAPSHOT_SCRIPT = `
{{ outpost_scripts.apply_snapshot }}`;
