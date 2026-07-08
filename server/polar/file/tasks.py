from typing import Any

import structlog

from polar.config import settings
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .repository import FileRepository
from .service import file as file_service

log = structlog.get_logger()


@actor(actor_name="file.guardduty_scan_result", priority=TaskPriority.MEDIUM)
async def guardduty_scan_result(scan_result: dict[str, Any]) -> None:
    s3_object = scan_result["s3ObjectDetails"]
    bucket_name = s3_object["bucketName"]
    object_key = s3_object["objectKey"]

    if bucket_name not in (
        settings.S3_FILES_BUCKET_NAME,
        settings.S3_FILES_PUBLIC_BUCKET_NAME,
    ):
        log.warning(
            "file.guardduty_scan_result.unexpected_bucket",
            bucket_name=bucket_name,
            object_key=object_key,
        )
        return

    async with AsyncSessionMaker() as session:
        repository = FileRepository.from_session(session)
        file = await repository.get_by_path(object_key)
        if file is None:
            log.warning(
                "file.guardduty_scan_result.file_not_found",
                bucket_name=bucket_name,
                object_key=object_key,
            )
            return

        await file_service.flag_malicious(
            session, file=file, scan_result_details=scan_result["scanResultDetails"]
        )
