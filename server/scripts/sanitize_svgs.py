"""
Sanitize public SVGs uploaded before svg-hush ran on upload.

Dry-run by default. Rejected files are reported, not touched. Invalidate
/product_media/* and /organization_avatar/* on CloudFront after --execute.
"""

import typer
from botocore.exceptions import ClientError
from py_svg_hush import filter_svg
from rich.console import Console
from sqlalchemy import select

from polar.file.s3 import S3_SERVICES
from polar.file.service import (
    SVG_DATA_URL_MIME_TYPES,
    SVG_MIME_TYPE,
    SVG_SANITIZED_SERVICES,
)
from polar.integrations.aws.s3.exceptions import S3FileError
from polar.integrations.aws.s3.schemas import S3File
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import File
from polar.postgres import create_async_engine

from .helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()

configure_script_console_logging()


@cli.command()
@typer_async
async def sanitize(
    execute: bool = typer.Option(
        False, help="Rewrite the S3 objects and file records (default: dry-run)"
    ),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    changed = repaired = rejected = missing = oversized = 0

    try:
        async with sessionmaker() as session:
            statement = (
                select(File)
                .where(
                    File.mime_type == SVG_MIME_TYPE,
                    File.service.in_(SVG_SANITIZED_SERVICES),
                    File.is_uploaded,
                    ~File.is_deleted,
                )
                .order_by(File.created_at)
            )
            files = (await session.scalars(statement)).all()
            console.print(f"[cyan]{len(files)} SVG file(s) to check.")

            for file in files:
                s3_service = S3_SERVICES[file.service]
                try:
                    s3_object = s3_service.get_object_or_raise(file.path)
                except S3FileError as e:
                    cause = e.__cause__
                    if not (
                        isinstance(cause, ClientError)
                        and cause.response["Error"]["Code"] == "NoSuchKey"
                    ):
                        raise
                    missing += 1
                    console.print(f"[yellow]{file.id} {file.path}: missing on S3")
                    continue

                if s3_object["ContentLength"] > file.size:
                    oversized += 1
                    console.print(f"[red]{file.id} {file.path}: larger than declared")
                    continue

                original = s3_object["Body"].read()
                try:
                    sanitized = filter_svg(original, SVG_DATA_URL_MIME_TYPES)
                except ValueError as e:
                    rejected += 1
                    console.print(f"[red]{file.id} {file.path}: {e}")
                    continue

                if sanitized == original:
                    if s3_object["ETag"] == file.checksum_etag:
                        continue
                    repaired += 1
                    s3file = S3File.from_head(file.path, s3_object)
                else:
                    changed += 1
                    if not execute:
                        continue
                    s3file = s3_service.replace_object(
                        S3File.model_validate(file, from_attributes=True), sanitized
                    )

                if not execute:
                    continue
                file.size = s3file.size
                file.checksum_sha256_base64 = s3file.checksum_sha256_base64
                file.checksum_sha256_hex = s3file.checksum_sha256_hex
                file.checksum_etag = s3file.checksum_etag
                file.last_modified_at = s3file.last_modified_at
                file.storage_version = s3file.storage_version
                session.add(file)
                await session.commit()
    finally:
        await engine.dispose()

    verb = "Rewrote" if execute else "Would rewrite"
    console.print(
        f"[green]{verb} {changed} file(s), repair {repaired} record(s); "
        f"{rejected} rejected, {oversized} oversized, {missing} missing."
    )


if __name__ == "__main__":
    cli()
