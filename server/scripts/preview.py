import hashlib
import json
import os
import re
import secrets
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

cli = typer.Typer()


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
    return (os.getenv("PREVIEW_BASE_DOMAIN") or DEFAULT_PREVIEW_BASE_DOMAIN).strip()


def build_preview_url(preview_id: str) -> str:
    return f"https://{preview_id}.{get_preview_base_domain()}"


def plan_create_or_update(changed_surfaces: ChangedSurfaces) -> list[str]:
    steps = [
        "materialize_source",
        "ensure_preview_database",
        "ensure_tinybird_workspace",
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
        "delete_tinybird_workspace",
        "revoke_preview_credentials",
        "delete_preview_runtime",
    ]


def plan_reset_data() -> list[str]:
    return [
        "stop_preview_services",
        "recreate_preview_database",
        "redeploy_tinybird",
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
    admin_dsn = os.getenv("PREVIEW_POSTGRES_ADMIN_DSN")
    if not admin_dsn:
        raise RuntimeError("PREVIEW_POSTGRES_ADMIN_DSN is required")

    parsed_admin_dsn = urlparse(admin_dsn)
    if not parsed_admin_dsn.scheme or parsed_admin_dsn.hostname is None:
        raise RuntimeError("PREVIEW_POSTGRES_ADMIN_DSN must be a valid Postgres DSN")

    app_host_override = os.getenv("PREVIEW_POSTGRES_APP_HOST")
    app_host = (app_host_override or parsed_admin_dsn.hostname or "").strip()
    if not app_host:
        raise RuntimeError("Could not resolve the preview Postgres host")

    app_port_raw = (os.getenv("PREVIEW_POSTGRES_APP_PORT") or "").strip()
    if not app_port_raw:
        app_port = parsed_admin_dsn.port or DEFAULT_POSTGRES_PORT
    else:
        app_port = int(app_port_raw)

    template_database_raw = (
        os.getenv("PREVIEW_POSTGRES_TEMPLATE_DATABASE") or ""
    ).strip()
    template_database: str | None
    if template_database_raw:
        template_database = validate_safe_postgres_identifier(
            template_database_raw,
            env_name="PREVIEW_POSTGRES_TEMPLATE_DATABASE",
        )
    else:
        template_database = None

    return PreviewPostgresAdminConfig(
        admin_dsn=admin_dsn,
        app_host=app_host,
        app_port=app_port,
        template_database=template_database,
    )


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


def mask_github_secret(secret: str) -> None:
    typer.echo(f"::add-mask::{secret}", err=True)


def provision_preview_postgres(
    preview_id: str,
    *,
    config: PreviewPostgresAdminConfig,
) -> PreviewPostgresProvisionResult:
    database_name = build_preview_database_name(preview_id)
    role_name = build_preview_role_name(preview_id)
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

            cursor.execute(f"REVOKE ALL ON DATABASE {database_name} FROM PUBLIC")

            if role_exists:
                cursor.execute(
                    f"ALTER ROLE {role_name} WITH PASSWORD %s",
                    (password,),
                )
        except Exception:
            if database_created:
                cursor.execute(
                    "SELECT pg_terminate_backend(pid) "
                    "FROM pg_stat_activity "
                    "WHERE datname = %s AND pid <> pg_backend_pid()",
                    (database_name,),
                )
                cursor.execute(f"DROP DATABASE {database_name}")
            if role_created:
                cursor.execute(f"DROP ROLE {role_name}")
            raise
        finally:
            cursor.close()
    finally:
        connection.close()

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


def teardown_preview_postgres(
    preview_id: str,
    *,
    config: PreviewPostgresAdminConfig,
) -> PreviewPostgresTeardownResult:
    database_name = build_preview_database_name(preview_id)
    role_name = build_preview_role_name(preview_id)
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

            if database_exists:
                cursor.execute(
                    "SELECT pg_terminate_backend(pid) "
                    "FROM pg_stat_activity "
                    "WHERE datname = %s AND pid <> pg_backend_pid()",
                    (database_name,),
                )
                cursor.execute(f"DROP DATABASE {database_name}")

            if role_exists:
                cursor.execute(f"DROP ROLE {role_name}")
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

    postgres_result: PreviewPostgresProvisionResult | None = None
    if not dry_run:
        postgres_result = provision_preview_postgres(
            resolved_preview_id,
            config=load_preview_postgres_admin_config(),
        )

    result = build_result(
        action="create-or-update",
        preview_id=resolved_preview_id,
        branch=branch,
        sha=sha,
        changed_surfaces=changed_surfaces,
        steps=plan_create_or_update(changed_surfaces),
        dry_run=dry_run,
        status="planned" if dry_run else "database-ready",
    )
    emit_preview_result(
        result,
        github_output,
        github_values=(
            build_postgres_provision_github_values(postgres_result)
            if postgres_result is not None
            else None
        ),
        masked_secrets=[postgres_result.password]
        if postgres_result is not None
        else None,
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

    postgres_result: PreviewPostgresTeardownResult | None = None
    if not dry_run:
        postgres_result = teardown_preview_postgres(
            resolved_preview_id,
            config=load_preview_postgres_admin_config(),
        )

    result = build_result(
        action="destroy",
        preview_id=resolved_preview_id,
        branch=branch,
        sha=sha,
        changed_surfaces=ChangedSurfaces(),
        steps=plan_destroy(),
        dry_run=dry_run,
        status="planned" if dry_run else "database-destroyed",
    )
    emit_preview_result(
        result,
        github_output,
        github_values=(
            build_postgres_teardown_github_values(postgres_result)
            if postgres_result is not None
            else None
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

    postgres_result: PreviewPostgresProvisionResult | None = None
    if not dry_run:
        teardown_preview_postgres(
            resolved_preview_id,
            config=load_preview_postgres_admin_config(),
        )
        postgres_result = provision_preview_postgres(
            resolved_preview_id,
            config=load_preview_postgres_admin_config(),
        )

    result = build_result(
        action="reset-data",
        preview_id=resolved_preview_id,
        branch=branch,
        sha=sha,
        changed_surfaces=ChangedSurfaces(),
        steps=plan_reset_data(),
        dry_run=dry_run,
        status="planned" if dry_run else "database-reset",
    )
    emit_preview_result(
        result,
        github_output,
        github_values=(
            build_postgres_provision_github_values(postgres_result)
            if postgres_result is not None
            else None
        ),
        masked_secrets=[postgres_result.password]
        if postgres_result is not None
        else None,
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


if __name__ == "__main__":
    cli()
