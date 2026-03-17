import hashlib
import json
import os
import re
import secrets
import subprocess
import time
from dataclasses import asdict, dataclass, is_dataclass
from pathlib import Path
from typing import Any, TextIO
from urllib.parse import urlparse

import psycopg2
import typer

DEFAULT_PREVIEW_BASE_DOMAIN = "preview.polar.sh"
MAX_PREVIEW_ID_LENGTH = 63
MAX_POSTGRES_IDENTIFIER_LENGTH = 63
DEFAULT_POSTGRES_PORT = 5432
PREVIEW_POSTGRES_DROP_RETRIES = 5
PREVIEW_POSTGRES_DROP_RETRY_DELAY_SECONDS = 1.0

cli = typer.Typer()


def log_preview(message: str) -> None:
    typer.echo(f"[previewctl] {message}", err=True)


@dataclass(frozen=True)
class ChangedSurfaces:
    backend: bool = False
    frontend: bool = False
    migrations: bool = False
    tinybird: bool = False


@dataclass(frozen=True)
class PreviewResult:
    action: str
    preview_id: str
    preview_url: str
    status: str
    branch: str | None
    sha: str | None
    changed_surfaces: ChangedSurfaces
    steps: list[str]
    dry_run: bool


@dataclass(frozen=True)
class PreviewPostgresAdminConfig:
    admin_dsn: str
    app_host: str
    app_port: int
    template_database: str | None


@dataclass(frozen=True)
class PreviewPostgresProvisionResult:
    preview_id: str
    database_name: str
    role_name: str
    host: str
    port: int
    password: str
    env: dict[str, str]


@dataclass(frozen=True)
class PreviewPostgresTeardownResult:
    preview_id: str
    database_name: str
    database_existed: bool
    role_name: str
    role_existed: bool


@dataclass(frozen=True)
class PreviewTinybirdAdminConfig:
    api_url: str
    admin_token: str
    workspace_name: str
    last_partition: bool


@dataclass(frozen=True)
class PreviewTinybirdProvisionResult:
    preview_id: str
    branch_name: str
    workspace_name: str
    api_url: str
    token: str
    env: dict[str, str]


@dataclass(frozen=True)
class PreviewTinybirdTeardownResult:
    preview_id: str
    branch_name: str
    branch_existed: bool


def sanitize_preview_label(value: str) -> str:
    sanitized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    collapsed = re.sub(r"-{2,}", "-", sanitized)
    if not collapsed:
        raise ValueError(
            "Could not derive a preview identifier from the provided value"
        )
    return collapsed


def normalize_postgres_identifier_component(value: str) -> str:
    sanitized = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    collapsed = re.sub(r"_{2,}", "_", sanitized)
    if not collapsed:
        raise ValueError(
            "Could not derive a Postgres identifier from the provided value"
        )
    return collapsed


def build_postgres_identifier(preview_id: str, *, suffix: str | None = None) -> str:
    normalized_preview_id = normalize_postgres_identifier_component(preview_id)
    suffix_segment = f"_{suffix}" if suffix else ""
    identifier = f"preview_{normalized_preview_id}{suffix_segment}"

    if len(identifier) <= MAX_POSTGRES_IDENTIFIER_LENGTH:
        return identifier

    hash_suffix = hashlib.sha1(normalized_preview_id.encode("utf-8")).hexdigest()[:8]
    max_preview_component_length = (
        MAX_POSTGRES_IDENTIFIER_LENGTH
        - len("preview_")
        - len(suffix_segment)
        - len(hash_suffix)
        - 1
    )
    if max_preview_component_length <= 0:
        return f"preview_{hash_suffix}{suffix_segment}"

    truncated_preview_id = normalized_preview_id[:max_preview_component_length].rstrip(
        "_"
    )
    if not truncated_preview_id:
        return f"preview_{hash_suffix}{suffix_segment}"

    return f"preview_{truncated_preview_id}_{hash_suffix}{suffix_segment}"


def build_preview_database_name(preview_id: str) -> str:
    return build_postgres_identifier(preview_id)


def build_preview_role_name(preview_id: str) -> str:
    return build_postgres_identifier(preview_id, suffix="app")


def build_preview_tinybird_branch_name(preview_id: str) -> str:
    return build_postgres_identifier(preview_id)


def resolve_preview_id(
    preview_id: str | None,
    pr_number: int | None,
    branch: str | None,
) -> str:
    if preview_id:
        candidate = preview_id
    elif pr_number is not None:
        candidate = f"pr-{pr_number}"
    elif branch:
        candidate = f"branch-{sanitize_preview_label(branch)}"
    else:
        raise ValueError("Either preview_id, pr_number, or branch is required")

    resolved = sanitize_preview_label(candidate)[:MAX_PREVIEW_ID_LENGTH].strip("-")
    if not resolved:
        raise ValueError("Resolved preview identifier is empty")
    return resolved


def get_preview_base_domain() -> str:
    return (
        os.getenv("POLAR_PREVIEW_BASE_DOMAIN") or DEFAULT_PREVIEW_BASE_DOMAIN
    ).strip()


def build_preview_url(preview_id: str) -> str:
    return f"https://{preview_id}.{get_preview_base_domain()}"


def plan_create_or_update(changed_surfaces: ChangedSurfaces) -> list[str]:
    steps = [
        "materialize_source",
        "ensure_preview_database",
        "ensure_tinybird_branch",
        "ensure_preview_secrets",
    ]

    if changed_surfaces.migrations:
        steps.append("run_database_migrations")
    if changed_surfaces.tinybird:
        steps.append("deploy_tinybird")

    if changed_surfaces.backend or changed_surfaces.migrations:
        steps.append("update_backend_services")
    else:
        steps.append("ensure_backend_services")

    if changed_surfaces.frontend:
        steps.append("update_frontend_service")
    else:
        steps.append("ensure_frontend_service")

    steps.append("run_health_checks")
    return steps


def plan_destroy() -> list[str]:
    return [
        "disable_preview_routing",
        "stop_preview_services",
        "drop_preview_database",
        "delete_tinybird_branch",
        "revoke_preview_credentials",
        "delete_preview_runtime",
    ]


def plan_reset_data() -> list[str]:
    return [
        "stop_preview_services",
        "recreate_preview_database",
        "recreate_tinybird_branch",
        "seed_preview_data",
        "start_preview_services",
        "run_health_checks",
    ]


def render_json_result(result: Any) -> str:
    if is_dataclass(result) and not isinstance(result, type):
        payload = asdict(result)
    else:
        payload = result
    return json.dumps(payload, separators=(",", ":"), sort_keys=True)


def render_result(result: PreviewResult) -> str:
    return render_json_result(result)


def describe_changed_surfaces(changed_surfaces: ChangedSurfaces) -> str:
    return (
        ",".join(
            surface_name
            for surface_name, changed in asdict(changed_surfaces).items()
            if changed
        )
        or "none"
    )


def serialize_github_output_value(value: object) -> str:
    if isinstance(value, bool):
        return json.dumps(value)
    if isinstance(value, dict):
        return json.dumps(value, separators=(",", ":"), sort_keys=True)
    return str(value)


def write_generic_github_output(
    output_path: Path,
    *,
    values: dict[str, object],
    stream: TextIO | None = None,
) -> None:
    output = stream if stream is not None else output_path.open("a", encoding="utf-8")
    try:
        for key, value in values.items():
            output.write(f"{key}={serialize_github_output_value(value)}\n")
    finally:
        if stream is None:
            output.close()


def write_github_output(
    output_path: Path,
    *,
    result: PreviewResult,
    stream: TextIO | None = None,
) -> None:
    write_generic_github_output(
        output_path,
        values={
            "preview_id": result.preview_id,
            "preview_url": result.preview_url,
            "preview_status": result.status,
            "result_json": render_result(result),
        },
        stream=stream,
    )


def build_result(
    *,
    action: str,
    preview_id: str,
    branch: str | None,
    sha: str | None,
    changed_surfaces: ChangedSurfaces,
    steps: list[str],
    dry_run: bool,
    status: str | None = None,
) -> PreviewResult:
    return PreviewResult(
        action=action,
        preview_id=preview_id,
        preview_url=build_preview_url(preview_id),
        status=status or ("planned" if dry_run else "ready"),
        branch=branch,
        sha=sha,
        changed_surfaces=changed_surfaces,
        steps=steps,
        dry_run=dry_run,
    )


def validate_safe_postgres_identifier(value: str, *, env_name: str) -> str:
    normalized_value = value.strip().lower()
    if not normalized_value:
        raise RuntimeError(f"{env_name} is empty")
    if not re.fullmatch(r"[a-z0-9_]+", normalized_value):
        raise RuntimeError(
            f"{env_name} must only contain lowercase letters, numbers, and underscores"
        )
    return normalized_value


def load_preview_postgres_admin_config() -> PreviewPostgresAdminConfig:
    admin_dsn = os.getenv("POLAR_PREVIEW_POSTGRES_ADMIN_DSN")
    if not admin_dsn:
        raise RuntimeError("POLAR_PREVIEW_POSTGRES_ADMIN_DSN is required")

    parsed_admin_dsn = urlparse(admin_dsn)
    if not parsed_admin_dsn.scheme or parsed_admin_dsn.hostname is None:
        raise RuntimeError(
            "POLAR_PREVIEW_POSTGRES_ADMIN_DSN must be a valid Postgres DSN"
        )

    app_host_override = os.getenv("POLAR_PREVIEW_POSTGRES_APP_HOST")
    app_host = (app_host_override or parsed_admin_dsn.hostname or "").strip()
    if not app_host:
        raise RuntimeError("Could not resolve the preview Postgres host")

    app_port_raw = (os.getenv("POLAR_PREVIEW_POSTGRES_APP_PORT") or "").strip()
    if not app_port_raw:
        app_port = parsed_admin_dsn.port or DEFAULT_POSTGRES_PORT
    else:
        app_port = int(app_port_raw)

    template_database_raw = (
        os.getenv("POLAR_PREVIEW_POSTGRES_TEMPLATE_DATABASE") or ""
    ).strip()
    template_database: str | None
    if template_database_raw:
        template_database = validate_safe_postgres_identifier(
            template_database_raw,
            env_name="POLAR_PREVIEW_POSTGRES_TEMPLATE_DATABASE",
        )
    else:
        template_database = None

    config = PreviewPostgresAdminConfig(
        admin_dsn=admin_dsn,
        app_host=app_host,
        app_port=app_port,
        template_database=template_database,
    )
    log_preview(
        "Loaded preview Postgres config "
        f"host={config.app_host} port={config.app_port} "
        f"template={config.template_database or 'none'}"
    )
    return config


def parse_env_bool(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def load_preview_tinybird_admin_config() -> PreviewTinybirdAdminConfig:
    api_url = (os.getenv("POLAR_PREVIEW_TINYBIRD_API_URL") or "").strip()
    if not api_url:
        raise RuntimeError("POLAR_PREVIEW_TINYBIRD_API_URL is required")

    admin_token = (os.getenv("POLAR_PREVIEW_TINYBIRD_ADMIN_TOKEN") or "").strip()
    if not admin_token:
        raise RuntimeError("POLAR_PREVIEW_TINYBIRD_ADMIN_TOKEN is required")

    workspace_name = (os.getenv("POLAR_PREVIEW_TINYBIRD_WORKSPACE") or "").strip()
    if not workspace_name:
        raise RuntimeError("POLAR_PREVIEW_TINYBIRD_WORKSPACE is required")

    config = PreviewTinybirdAdminConfig(
        api_url=api_url,
        admin_token=admin_token,
        workspace_name=workspace_name,
        last_partition=parse_env_bool(
            os.getenv("POLAR_PREVIEW_TINYBIRD_LAST_PARTITION")
        ),
    )
    log_preview(
        "Loaded preview Tinybird config "
        f"api_url={config.api_url} workspace={config.workspace_name} "
        f"last_partition={config.last_partition}"
    )
    return config


def generate_preview_password() -> str:
    return secrets.token_urlsafe(24)


def connect_preview_postgres_admin(config: PreviewPostgresAdminConfig) -> Any:
    connection = psycopg2.connect(config.admin_dsn)
    connection.autocommit = True
    return connection


def build_preview_postgres_env(
    *,
    config: PreviewPostgresAdminConfig,
    database_name: str,
    role_name: str,
    password: str,
) -> dict[str, str]:
    return {
        "POLAR_POSTGRES_DATABASE": database_name,
        "POLAR_POSTGRES_HOST": config.app_host,
        "POLAR_POSTGRES_PORT": str(config.app_port),
        "POLAR_POSTGRES_PWD": password,
        "POLAR_POSTGRES_USER": role_name,
    }


def build_preview_tinybird_env(
    *,
    config: PreviewTinybirdAdminConfig,
    branch_name: str,
    token: str,
) -> dict[str, str]:
    return {
        "TINYBIRD_API_TOKEN": token,
        "TINYBIRD_API_URL": config.api_url,
        "TINYBIRD_BRANCH": branch_name,
        "TINYBIRD_READ_TOKEN": token,
        "TINYBIRD_WORKSPACE": config.workspace_name,
    }


def mask_github_secret(secret: str) -> None:
    typer.echo(f"::add-mask::{secret}", err=True)


def get_preview_tinybird_cwd() -> str | None:
    tinybird_dir = Path(__file__).resolve().parent.parent / "tinybird"
    if tinybird_dir.is_dir():
        return str(tinybird_dir)
    return None


def build_tinybird_cli_command(
    config: PreviewTinybirdAdminConfig,
    *args: str,
) -> list[str]:
    command = [
        "tb",
        "--cloud",
        "--host",
        config.api_url,
        "--token",
        config.admin_token,
    ]
    command.extend(args)
    return command


def redact_tinybird_text(text: str, *, admin_token: str) -> str:
    redacted = text.replace(admin_token, "[redacted]")
    redacted = re.sub(r'("token"\s*:\s*")[^"]+(")', r"\1[redacted]\2", redacted)
    redacted = re.sub(
        r'("TINYBIRD_(?:API|READ)_TOKEN"\s*:\s*")[^"]+(")',
        r"\1[redacted]\2",
        redacted,
    )
    return redacted


def render_tinybird_cli_command(
    config: PreviewTinybirdAdminConfig,
    *args: str,
) -> str:
    command = build_tinybird_cli_command(config, *args)
    rendered_parts: list[str] = []
    redact_next = False
    for part in command:
        if redact_next:
            rendered_parts.append("[redacted]")
            redact_next = False
            continue
        rendered_parts.append(part)
        if part == "--token":
            redact_next = True
    return " ".join(rendered_parts)


def run_tinybird_cli_command(
    config: PreviewTinybirdAdminConfig,
    *args: str,
) -> str:
    command = build_tinybird_cli_command(config, *args)
    command_display = render_tinybird_cli_command(config, *args)
    cwd = get_preview_tinybird_cwd()
    log_preview(f"Running Tinybird CLI cwd={cwd or '.'} command={command_display}")
    result = subprocess.run(
        command,
        capture_output=True,
        check=False,
        cwd=cwd,
        text=True,
    )
    if result.stderr.strip():
        log_preview(
            "Tinybird CLI stderr:\n"
            + redact_tinybird_text(result.stderr, admin_token=config.admin_token)
        )
    if result.stdout.strip() and args[:2] != ("--output", "json"):
        log_preview(
            "Tinybird CLI stdout:\n"
            + redact_tinybird_text(result.stdout, admin_token=config.admin_token)
        )
    if result.returncode != 0:
        raise RuntimeError(
            "Tinybird command failed: "
            f"{command_display}\n"
            "stdout:\n"
            f"{redact_tinybird_text(result.stdout, admin_token=config.admin_token)}\n"
            "stderr:\n"
            f"{redact_tinybird_text(result.stderr, admin_token=config.admin_token)}"
        )
    return result.stdout


def get_tinybird_info(config: PreviewTinybirdAdminConfig) -> dict[str, Any]:
    output = run_tinybird_cli_command(
        config,
        "--output",
        "json",
        "info",
        "--skip-local",
    )
    try:
        info = json.loads(output)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Could not parse Tinybird JSON output: {output}") from exc
    workspace_name = get_tinybird_workspace_name(info) or "unknown"
    branch_names = get_tinybird_branch_names(info)
    current_branch = info.get("branches", {}).get("current") or "main"
    log_preview(
        "Loaded Tinybird info "
        f"workspace={workspace_name} current_branch={current_branch} "
        f"branch_count={len(branch_names)} branches={','.join(branch_names) or 'none'}"
    )
    return info


def get_tinybird_workspace_name(info: dict[str, Any]) -> str | None:
    workspace = info.get("workspace")
    if isinstance(workspace, dict):
        workspace_name = workspace.get("name")
        if isinstance(workspace_name, str):
            normalized_workspace_name = workspace_name.strip()
            if normalized_workspace_name:
                return normalized_workspace_name

    cloud = info.get("cloud")
    if isinstance(cloud, dict):
        cloud_workspace_name = cloud.get("workspace_name")
        if isinstance(cloud_workspace_name, str):
            normalized_cloud_workspace_name = cloud_workspace_name.strip()
            if normalized_cloud_workspace_name:
                return normalized_cloud_workspace_name

    return None


def get_tinybird_branch_names(info: dict[str, Any]) -> list[str]:
    branches = info.get("branches", {}).get("items", [])
    return sorted(
        branch_name
        for branch in branches
        if isinstance(branch, dict)
        for branch_name in [branch.get("name")]
        if isinstance(branch_name, str) and branch_name.strip()
    )


def validate_tinybird_workspace(
    info: dict[str, Any],
    config: PreviewTinybirdAdminConfig,
) -> None:
    workspace_name = get_tinybird_workspace_name(info)
    if workspace_name is None:
        return

    if workspace_name != config.workspace_name:
        raise RuntimeError(
            "Tinybird token resolved to the wrong workspace: "
            f"expected {config.workspace_name}, got {workspace_name}"
        )


def get_tinybird_branch_info(
    config: PreviewTinybirdAdminConfig,
    branch_name: str,
) -> dict[str, Any] | None:
    info = get_tinybird_info(config)
    validate_tinybird_workspace(info, config)
    branches = info.get("branches", {}).get("items", [])
    for branch in branches:
        if branch.get("name") == branch_name:
            return branch
    return None


def grant_preview_role_to_control_plane(cursor: Any, role_name: str) -> None:
    cursor.execute(f"GRANT {role_name} TO CURRENT_USER")


def revoke_preview_role_from_control_plane(cursor: Any, role_name: str) -> None:
    cursor.execute(f"REVOKE {role_name} FROM CURRENT_USER")


def terminate_preview_database_connections(cursor: Any, database_name: str) -> None:
    cursor.execute(
        "SELECT pg_terminate_backend(activity.pid) "
        "FROM pg_stat_activity AS activity "
        "LEFT JOIN pg_roles AS roles ON roles.rolname = activity.usename "
        "WHERE activity.datname = %s "
        "AND activity.pid <> pg_backend_pid() "
        "AND activity.backend_type = 'client backend' "
        "AND COALESCE(roles.rolsuper, false) = false",
        (database_name,),
    )


def get_preview_database_connections(
    cursor: Any, database_name: str
) -> list[tuple[Any, ...]]:
    cursor.execute(
        "SELECT usename, backend_type, application_name, state "
        "FROM pg_stat_activity "
        "WHERE datname = %s AND pid <> pg_backend_pid() "
        "ORDER BY backend_type, usename NULLS LAST, application_name",
        (database_name,),
    )
    return list(cursor.fetchall())


def drop_preview_database(cursor: Any, database_name: str) -> None:
    last_error: Exception | None = None

    for attempt in range(PREVIEW_POSTGRES_DROP_RETRIES):
        try:
            cursor.execute(f"DROP DATABASE {database_name}")
            return
        except psycopg2.Error as error:
            last_error = error
            if attempt == PREVIEW_POSTGRES_DROP_RETRIES - 1:
                break
            time.sleep(PREVIEW_POSTGRES_DROP_RETRY_DELAY_SECONDS)

    remaining_connections = get_preview_database_connections(cursor, database_name)
    raise RuntimeError(
        "Could not drop preview Postgres database "
        f"{database_name}; remaining connections: {remaining_connections}"
    ) from last_error


def provision_preview_postgres(
    preview_id: str,
    *,
    config: PreviewPostgresAdminConfig,
) -> PreviewPostgresProvisionResult:
    database_name = build_preview_database_name(preview_id)
    role_name = build_preview_role_name(preview_id)
    log_preview(
        "Ensuring preview Postgres resources "
        f"preview_id={preview_id} database={database_name} role={role_name}"
    )
    password = generate_preview_password()
    connection = connect_preview_postgres_admin(config)
    role_created = False
    database_created = False

    try:
        cursor = connection.cursor()
        try:
            cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (role_name,))
            role_exists = cursor.fetchone() is not None
            cursor.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s",
                (database_name,),
            )
            database_exists = cursor.fetchone() is not None
            log_preview(
                "Preview Postgres state "
                f"database_exists={database_exists} role_exists={role_exists}"
            )

            if database_exists and not role_exists:
                raise RuntimeError(
                    "Preview Postgres database exists without the preview role for "
                    f"{preview_id}: {database_name}"
                )

            if not role_exists:
                cursor.execute(
                    f"CREATE ROLE {role_name} LOGIN PASSWORD %s", (password,)
                )
                role_created = True
                log_preview(f"Created preview Postgres role {role_name}")
            else:
                log_preview(f"Reusing preview Postgres role {role_name}")

            grant_preview_role_to_control_plane(cursor, role_name)

            if not database_exists:
                if config.template_database is None:
                    cursor.execute(
                        f"CREATE DATABASE {database_name} WITH OWNER {role_name}"
                    )
                else:
                    cursor.execute(
                        " ".join(
                            [
                                f"CREATE DATABASE {database_name}",
                                f"WITH OWNER {role_name}",
                                f"TEMPLATE {config.template_database}",
                            ]
                        )
                    )
                database_created = True
                log_preview(
                    "Created preview Postgres database "
                    f"{database_name}"
                    + (
                        f" from template {config.template_database}"
                        if config.template_database is not None
                        else ""
                    )
                )
            else:
                log_preview(f"Reusing preview Postgres database {database_name}")

            cursor.execute(f"REVOKE ALL ON DATABASE {database_name} FROM PUBLIC")

            if role_exists:
                cursor.execute(
                    f"ALTER ROLE {role_name} WITH PASSWORD %s",
                    (password,),
                )
                log_preview(f"Rotated preview Postgres password for {role_name}")
        except Exception:
            if database_created:
                cursor.execute(f"SET ROLE {role_name}")
                try:
                    terminate_preview_database_connections(cursor, database_name)
                    drop_preview_database(cursor, database_name)
                finally:
                    cursor.execute("RESET ROLE")
            if role_created:
                revoke_preview_role_from_control_plane(cursor, role_name)
                cursor.execute(f"DROP ROLE {role_name}")
            raise
        finally:
            cursor.close()
    finally:
        connection.close()

    log_preview(
        "Preview Postgres ready "
        f"database={database_name} role={role_name} host={config.app_host} port={config.app_port}"
    )
    return PreviewPostgresProvisionResult(
        preview_id=preview_id,
        database_name=database_name,
        role_name=role_name,
        host=config.app_host,
        port=config.app_port,
        password=password,
        env=build_preview_postgres_env(
            config=config,
            database_name=database_name,
            role_name=role_name,
            password=password,
        ),
    )


def provision_preview_tinybird(
    preview_id: str,
    *,
    config: PreviewTinybirdAdminConfig,
) -> PreviewTinybirdProvisionResult:
    branch_name = build_preview_tinybird_branch_name(preview_id)
    log_preview(
        "Ensuring preview Tinybird branch "
        f"preview_id={preview_id} workspace={config.workspace_name} branch={branch_name}"
    )
    branch = get_tinybird_branch_info(config, branch_name)

    if branch is None:
        log_preview(
            f"Preview Tinybird branch {branch_name} does not exist, creating it"
        )
        create_args = ["branch", "create"]
        if config.last_partition:
            create_args.append("--last-partition")
        create_args.append(branch_name)
        run_tinybird_cli_command(config, *create_args)
        branch = get_tinybird_branch_info(config, branch_name)
    else:
        log_preview(f"Reusing preview Tinybird branch {branch_name}")

    if branch is None:
        raise RuntimeError(
            f"Could not find Tinybird branch after creation: {branch_name}"
        )

    token = (branch.get("token") or "").strip()
    if not token or token == "No token found":
        raise RuntimeError(
            "Tinybird branch token was not returned for preview "
            f"{preview_id}: {branch_name}"
        )

    log_preview(
        "Preview Tinybird branch ready "
        f"workspace={config.workspace_name} branch={branch_name}"
    )
    return PreviewTinybirdProvisionResult(
        preview_id=preview_id,
        branch_name=branch_name,
        workspace_name=config.workspace_name,
        api_url=config.api_url,
        token=token,
        env=build_preview_tinybird_env(
            config=config,
            branch_name=branch_name,
            token=token,
        ),
    )


def teardown_preview_postgres(
    preview_id: str,
    *,
    config: PreviewPostgresAdminConfig,
) -> PreviewPostgresTeardownResult:
    database_name = build_preview_database_name(preview_id)
    role_name = build_preview_role_name(preview_id)
    log_preview(
        "Tearing down preview Postgres resources "
        f"preview_id={preview_id} database={database_name} role={role_name}"
    )
    connection = connect_preview_postgres_admin(config)

    try:
        cursor = connection.cursor()
        try:
            cursor.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s",
                (database_name,),
            )
            database_exists = cursor.fetchone() is not None
            cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (role_name,))
            role_exists = cursor.fetchone() is not None
            log_preview(
                "Preview Postgres teardown state "
                f"database_exists={database_exists} role_exists={role_exists}"
            )

            if database_exists and not role_exists:
                raise RuntimeError(
                    "Preview Postgres database exists without the preview role for "
                    f"{preview_id}: {database_name}"
                )

            if database_exists:
                grant_preview_role_to_control_plane(cursor, role_name)
                cursor.execute(f"SET ROLE {role_name}")
                try:
                    cursor.execute(
                        f"REVOKE CONNECT ON DATABASE {database_name} FROM PUBLIC"
                    )
                    cursor.execute(
                        f"REVOKE CONNECT ON DATABASE {database_name} FROM {role_name}"
                    )
                    cursor.execute(
                        f"ALTER DATABASE {database_name} WITH ALLOW_CONNECTIONS false"
                    )
                    terminate_preview_database_connections(cursor, database_name)
                    drop_preview_database(cursor, database_name)
                    log_preview(f"Dropped preview Postgres database {database_name}")
                finally:
                    cursor.execute("RESET ROLE")

            if role_exists:
                revoke_preview_role_from_control_plane(cursor, role_name)
                cursor.execute(f"DROP ROLE {role_name}")
                log_preview(f"Dropped preview Postgres role {role_name}")
        finally:
            cursor.close()
    finally:
        connection.close()

    return PreviewPostgresTeardownResult(
        preview_id=preview_id,
        database_name=database_name,
        database_existed=database_exists,
        role_name=role_name,
        role_existed=role_exists,
    )


def teardown_preview_tinybird(
    preview_id: str,
    *,
    config: PreviewTinybirdAdminConfig,
) -> PreviewTinybirdTeardownResult:
    branch_name = build_preview_tinybird_branch_name(preview_id)
    log_preview(
        "Tearing down preview Tinybird branch "
        f"preview_id={preview_id} workspace={config.workspace_name} branch={branch_name}"
    )
    branch = get_tinybird_branch_info(config, branch_name)

    if branch is not None:
        log_preview(f"Deleting preview Tinybird branch {branch_name}")
        run_tinybird_cli_command(
            config,
            "branch",
            "rm",
            branch_name,
            "--yes",
        )
    else:
        log_preview(f"Preview Tinybird branch {branch_name} already absent")

    return PreviewTinybirdTeardownResult(
        preview_id=preview_id,
        branch_name=branch_name,
        branch_existed=branch is not None,
    )


def emit_result(result: PreviewResult, github_output: Path | None) -> None:
    if github_output is not None:
        write_github_output(github_output, result=result)
    typer.echo(render_result(result))


def emit_preview_result(
    result: PreviewResult,
    github_output: Path | None,
    *,
    github_values: dict[str, object] | None = None,
    masked_secrets: list[str] | None = None,
) -> None:
    if masked_secrets is not None:
        for secret in masked_secrets:
            mask_github_secret(secret)

    if github_output is not None:
        write_github_output(github_output, result=result)
        if github_values is not None:
            write_generic_github_output(github_output, values=github_values)

    typer.echo(render_result(result))


def build_postgres_provision_github_values(
    result: PreviewPostgresProvisionResult,
) -> dict[str, object]:
    return {
        "preview_postgres_database": result.database_name,
        "preview_postgres_user": result.role_name,
        "preview_postgres_password": result.password,
        "preview_postgres_env_json": result.env,
    }


def build_postgres_teardown_github_values(
    result: PreviewPostgresTeardownResult,
) -> dict[str, object]:
    return {
        "preview_postgres_database": result.database_name,
        "preview_postgres_user": result.role_name,
        "preview_postgres_database_existed": result.database_existed,
        "preview_postgres_role_existed": result.role_existed,
    }


def build_tinybird_provision_github_values(
    result: PreviewTinybirdProvisionResult,
) -> dict[str, object]:
    return {
        "preview_tinybird_branch": result.branch_name,
        "preview_tinybird_token": result.token,
        "preview_tinybird_env_json": result.env,
        "preview_tinybird_workspace": result.workspace_name,
    }


def build_tinybird_teardown_github_values(
    result: PreviewTinybirdTeardownResult,
) -> dict[str, object]:
    return {
        "preview_tinybird_branch": result.branch_name,
        "preview_tinybird_branch_existed": result.branch_existed,
    }


def emit_postgres_provision_result(
    result: PreviewPostgresProvisionResult,
    github_output: Path | None,
) -> None:
    mask_github_secret(result.password)
    if github_output is not None:
        write_generic_github_output(
            github_output,
            values=build_postgres_provision_github_values(result),
        )
    typer.echo(render_json_result(result))


def emit_postgres_teardown_result(
    result: PreviewPostgresTeardownResult,
    github_output: Path | None,
) -> None:
    if github_output is not None:
        write_generic_github_output(
            github_output,
            values=build_postgres_teardown_github_values(result),
        )
    typer.echo(render_json_result(result))


def emit_tinybird_provision_result(
    result: PreviewTinybirdProvisionResult,
    github_output: Path | None,
) -> None:
    mask_github_secret(result.token)
    if github_output is not None:
        write_generic_github_output(
            github_output,
            values=build_tinybird_provision_github_values(result),
        )
    typer.echo(render_json_result(result))


def emit_tinybird_teardown_result(
    result: PreviewTinybirdTeardownResult,
    github_output: Path | None,
) -> None:
    if github_output is not None:
        write_generic_github_output(
            github_output,
            values=build_tinybird_teardown_github_values(result),
        )
    typer.echo(render_json_result(result))


@cli.command("create-or-update")
def create_or_update(
    preview_id: str | None = typer.Option(None, "--preview-id"),
    pr_number: int | None = typer.Option(None, "--pr-number"),
    branch: str = typer.Option(..., "--branch"),
    sha: str = typer.Option(..., "--sha"),
    changed_backend: bool = typer.Option(
        False, "--changed-backend/--unchanged-backend"
    ),
    changed_frontend: bool = typer.Option(
        False, "--changed-frontend/--unchanged-frontend"
    ),
    changed_migrations: bool = typer.Option(
        False, "--changed-migrations/--unchanged-migrations"
    ),
    changed_tinybird: bool = typer.Option(
        False, "--changed-tinybird/--unchanged-tinybird"
    ),
    dry_run: bool = typer.Option(False, "--dry-run"),
    github_output: Path | None = typer.Option(None, "--github-output"),
) -> None:
    changed_surfaces = ChangedSurfaces(
        backend=changed_backend,
        frontend=changed_frontend,
        migrations=changed_migrations,
        tinybird=changed_tinybird,
    )
    resolved_preview_id = resolve_preview_id(preview_id, pr_number, branch)
    log_preview(
        "Starting preview create-or-update "
        f"preview_id={resolved_preview_id} branch={branch} sha={sha} "
        f"changed_surfaces={describe_changed_surfaces(changed_surfaces)} dry_run={dry_run}"
    )

    postgres_result: PreviewPostgresProvisionResult | None = None
    tinybird_result: PreviewTinybirdProvisionResult | None = None
    if not dry_run:
        postgres_config = load_preview_postgres_admin_config()
        tinybird_config = load_preview_tinybird_admin_config()
        postgres_result = provision_preview_postgres(
            resolved_preview_id,
            config=postgres_config,
        )
        tinybird_result = provision_preview_tinybird(
            resolved_preview_id,
            config=tinybird_config,
        )

    result = build_result(
        action="create-or-update",
        preview_id=resolved_preview_id,
        branch=branch,
        sha=sha,
        changed_surfaces=changed_surfaces,
        steps=plan_create_or_update(changed_surfaces),
        dry_run=dry_run,
        status="planned" if dry_run else "database-and-tinybird-ready",
    )
    emit_preview_result(
        result,
        github_output,
        github_values=(
            {
                **build_postgres_provision_github_values(postgres_result),
                **(
                    build_tinybird_provision_github_values(tinybird_result)
                    if tinybird_result is not None
                    else {}
                ),
            }
            if postgres_result is not None
            else (
                build_tinybird_provision_github_values(tinybird_result)
                if tinybird_result is not None
                else None
            )
        ),
        masked_secrets=[
            *([postgres_result.password] if postgres_result is not None else []),
            *([tinybird_result.token] if tinybird_result is not None else []),
        ]
        or None,
    )


@cli.command("destroy")
def destroy(
    preview_id: str | None = typer.Option(None, "--preview-id"),
    pr_number: int | None = typer.Option(None, "--pr-number"),
    branch: str | None = typer.Option(None, "--branch"),
    sha: str | None = typer.Option(None, "--sha"),
    dry_run: bool = typer.Option(False, "--dry-run"),
    github_output: Path | None = typer.Option(None, "--github-output"),
) -> None:
    resolved_preview_id = resolve_preview_id(preview_id, pr_number, branch)
    log_preview(
        "Starting preview destroy "
        f"preview_id={resolved_preview_id} branch={branch} sha={sha} dry_run={dry_run}"
    )

    postgres_result: PreviewPostgresTeardownResult | None = None
    tinybird_result: PreviewTinybirdTeardownResult | None = None
    if not dry_run:
        postgres_config = load_preview_postgres_admin_config()
        tinybird_config = load_preview_tinybird_admin_config()
        tinybird_result = teardown_preview_tinybird(
            resolved_preview_id,
            config=tinybird_config,
        )
        postgres_result = teardown_preview_postgres(
            resolved_preview_id,
            config=postgres_config,
        )

    result = build_result(
        action="destroy",
        preview_id=resolved_preview_id,
        branch=branch,
        sha=sha,
        changed_surfaces=ChangedSurfaces(),
        steps=plan_destroy(),
        dry_run=dry_run,
        status="planned" if dry_run else "database-and-tinybird-destroyed",
    )
    emit_preview_result(
        result,
        github_output,
        github_values=(
            {
                **build_postgres_teardown_github_values(postgres_result),
                **(
                    build_tinybird_teardown_github_values(tinybird_result)
                    if tinybird_result is not None
                    else {}
                ),
            }
            if postgres_result is not None
            else (
                build_tinybird_teardown_github_values(tinybird_result)
                if tinybird_result is not None
                else None
            )
        ),
    )


@cli.command("reset-data")
def reset_data(
    preview_id: str | None = typer.Option(None, "--preview-id"),
    pr_number: int | None = typer.Option(None, "--pr-number"),
    branch: str = typer.Option(..., "--branch"),
    sha: str = typer.Option(..., "--sha"),
    dry_run: bool = typer.Option(False, "--dry-run"),
    github_output: Path | None = typer.Option(None, "--github-output"),
) -> None:
    resolved_preview_id = resolve_preview_id(preview_id, pr_number, branch)
    log_preview(
        "Starting preview reset-data "
        f"preview_id={resolved_preview_id} branch={branch} sha={sha} dry_run={dry_run}"
    )

    postgres_result: PreviewPostgresProvisionResult | None = None
    tinybird_result: PreviewTinybirdProvisionResult | None = None
    if not dry_run:
        postgres_config = load_preview_postgres_admin_config()
        tinybird_config = load_preview_tinybird_admin_config()
        teardown_preview_tinybird(
            resolved_preview_id,
            config=tinybird_config,
        )
        teardown_preview_postgres(
            resolved_preview_id,
            config=postgres_config,
        )
        postgres_result = provision_preview_postgres(
            resolved_preview_id,
            config=postgres_config,
        )
        tinybird_result = provision_preview_tinybird(
            resolved_preview_id,
            config=tinybird_config,
        )

    result = build_result(
        action="reset-data",
        preview_id=resolved_preview_id,
        branch=branch,
        sha=sha,
        changed_surfaces=ChangedSurfaces(),
        steps=plan_reset_data(),
        dry_run=dry_run,
        status="planned" if dry_run else "database-and-tinybird-reset",
    )
    emit_preview_result(
        result,
        github_output,
        github_values=(
            {
                **build_postgres_provision_github_values(postgres_result),
                **(
                    build_tinybird_provision_github_values(tinybird_result)
                    if tinybird_result is not None
                    else {}
                ),
            }
            if postgres_result is not None
            else (
                build_tinybird_provision_github_values(tinybird_result)
                if tinybird_result is not None
                else None
            )
        ),
        masked_secrets=[
            *([postgres_result.password] if postgres_result is not None else []),
            *([tinybird_result.token] if tinybird_result is not None else []),
        ]
        or None,
    )


@cli.command("postgres-provision")
def postgres_provision(
    preview_id: str | None = typer.Option(None, "--preview-id"),
    pr_number: int | None = typer.Option(None, "--pr-number"),
    branch: str | None = typer.Option(None, "--branch"),
    github_output: Path | None = typer.Option(None, "--github-output"),
) -> None:
    resolved_preview_id = resolve_preview_id(preview_id, pr_number, branch)
    result = provision_preview_postgres(
        resolved_preview_id,
        config=load_preview_postgres_admin_config(),
    )
    emit_postgres_provision_result(result, github_output)


@cli.command("postgres-teardown")
def postgres_teardown(
    preview_id: str | None = typer.Option(None, "--preview-id"),
    pr_number: int | None = typer.Option(None, "--pr-number"),
    branch: str | None = typer.Option(None, "--branch"),
    github_output: Path | None = typer.Option(None, "--github-output"),
) -> None:
    resolved_preview_id = resolve_preview_id(preview_id, pr_number, branch)
    result = teardown_preview_postgres(
        resolved_preview_id,
        config=load_preview_postgres_admin_config(),
    )
    emit_postgres_teardown_result(result, github_output)


@cli.command("tinybird-provision")
def tinybird_provision(
    preview_id: str | None = typer.Option(None, "--preview-id"),
    pr_number: int | None = typer.Option(None, "--pr-number"),
    branch: str | None = typer.Option(None, "--branch"),
    github_output: Path | None = typer.Option(None, "--github-output"),
) -> None:
    resolved_preview_id = resolve_preview_id(preview_id, pr_number, branch)
    result = provision_preview_tinybird(
        resolved_preview_id,
        config=load_preview_tinybird_admin_config(),
    )
    emit_tinybird_provision_result(result, github_output)


@cli.command("tinybird-teardown")
def tinybird_teardown(
    preview_id: str | None = typer.Option(None, "--preview-id"),
    pr_number: int | None = typer.Option(None, "--pr-number"),
    branch: str | None = typer.Option(None, "--branch"),
    github_output: Path | None = typer.Option(None, "--github-output"),
) -> None:
    resolved_preview_id = resolve_preview_id(preview_id, pr_number, branch)
    result = teardown_preview_tinybird(
        resolved_preview_id,
        config=load_preview_tinybird_admin_config(),
    )
    emit_tinybird_teardown_result(result, github_output)


if __name__ == "__main__":
    cli()
