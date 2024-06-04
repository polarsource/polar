import base64
import hashlib
import mimetypes
from functools import cached_property
from pathlib import Path
from typing import Any
from uuid import UUID

import boto3
import pytest_asyncio
from botocore.config import Config

from polar.config import settings
from polar.file.schemas import FileCreate
from polar.integrations.aws.s3.schemas import (
    S3FileCreateMultipart,
    S3FileCreatePart,
    S3FileUploadPart,
)

pwd = Path(__file__).parent.absolute()


class TestFile:
    def __init__(self, name: str):
        self.name = name

    @cached_property
    def data(self) -> bytes:
        content = b""
        with open(f"{pwd}/assets/{self.name}", "rb") as fp:
            content = fp.read()
        return content

    @cached_property
    def checksums(self) -> dict[str, str]:
        h = hashlib.sha256()
        h.update(self.data)
        return dict(
            hex=h.hexdigest(),
            base64=base64.b64encode(h.digest()).decode("utf-8"),
        )

    @property
    def hex(self) -> str:
        return self.checksums["hex"]

    @property
    def base64(self) -> str:
        return self.checksums["base64"]

    @property
    def size(self) -> int:
        return len(self.data)

    @cached_property
    def mime_type(self) -> str:
        mimetype = mimetypes.guess_type(self.name)[0]
        if not mimetype:
            raise RuntimeError("Using an unrecognizable test file")
        return mimetype

    def get_chunk(self, part: S3FileUploadPart) -> bytes:
        return self.data[part.chunk_start : part.chunk_end]

    def build_create_part(self, number: int, parts: int) -> S3FileCreatePart:
        chunk_size = self.size // parts
        chunk_start = (number - 1) * chunk_size
        chunk_end = number * chunk_size
        if number == parts:
            chunk_end = self.size

        chunk = self.data[chunk_start:chunk_end]
        h = hashlib.sha256()
        h.update(chunk)
        chunk_base64 = base64.b64encode(h.digest()).decode("utf-8")

        return S3FileCreatePart(
            number=number,
            chunk_start=chunk_start,
            chunk_end=chunk_end,
            checksum_sha256_base64=chunk_base64,
        )

    def build_create_payload(
        self, organization_id: UUID, parts: int = 1
    ) -> dict[str, Any]:
        create_parts = []
        for i in range(parts):
            part = self.build_create_part(i + 1, parts)
            create_parts.append(part)

        create = FileCreate(
            organization_id=organization_id,
            name=self.name,
            mime_type=self.mime_type,
            size=self.size,
            checksum_sha256_base64=self.base64,
            upload=S3FileCreateMultipart(parts=create_parts),
        )
        data = create.model_dump(mode="json")
        return data


@pytest_asyncio.fixture(scope="session", autouse=True)
async def empty_test_bucket() -> None:
    if not settings.S3_ENDPOINT_URL:
        raise RuntimeError("S3_ENDPOINT_URL not set")

    if not settings.S3_ENDPOINT_URL.startswith("http://127.0.0.1:9000"):
        raise RuntimeError("S3_ENDPOINT_URL not local development")

    if not settings.S3_FILES_BUCKET_NAME.startswith("testing"):
        raise RuntimeError("S3_FILES_BUCKET_NAME not a test bucket")

    s3 = boto3.resource(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        # Use MinIO development (admin) credentials
        aws_access_key_id=settings.MINIO_USER,
        aws_secret_access_key=settings.MINIO_PWD,
        config=Config(
            signature_version=settings.AWS_SIGNATURE_VERSION,
        ),
    )

    bucket = s3.Bucket(settings.S3_FILES_BUCKET_NAME)
    bucket.object_versions.delete()


@pytest_asyncio.fixture(scope="function")
def logo_png() -> TestFile:
    return TestFile("logo.png")


@pytest_asyncio.fixture(scope="function")
def logo_jpg() -> TestFile:
    return TestFile("logo.jpg")


@pytest_asyncio.fixture(scope="function")
def logo_zip() -> TestFile:
    return TestFile("logo.zip")
