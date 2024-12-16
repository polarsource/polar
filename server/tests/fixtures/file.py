import base64
import hashlib
import mimetypes
from collections.abc import Iterable
from functools import cached_property
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse
from uuid import UUID

import boto3
import pytest
import pytest_asyncio
from botocore.config import Config
from httpx import AsyncClient, Response
from minio import Minio

from polar.config import settings
from polar.file.s3 import S3_SERVICES
from polar.file.schemas import DownloadableFileCreate, FileUpload, FileUploadCompleted
from polar.file.service import file as file_service
from polar.integrations.aws.s3.schemas import (
    S3FileCreateMultipart,
    S3FileCreatePart,
    S3FileUploadCompleted,
    S3FileUploadCompletedPart,
    S3FileUploadPart,
)
from polar.models import File, Organization
from polar.models.file import FileServiceTypes
from polar.postgres import AsyncSession

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

    #####################################################################
    # CREATE
    #####################################################################

    async def create(
        self, session: AsyncSession, organization: Organization, parts: int = 1
    ) -> FileUpload:
        return await file_service.generate_presigned_upload(
            session,
            organization=organization,
            create_schema=self.build_create(organization.id, parts=parts),
        )

    def build_create(
        self, organization_id: UUID, parts: int = 1
    ) -> DownloadableFileCreate:
        create_parts = []
        for i in range(parts):
            part = self.build_create_part(i + 1, parts)
            create_parts.append(part)

        return DownloadableFileCreate(
            service=FileServiceTypes.downloadable,
            organization_id=organization_id,
            name=self.name,
            mime_type=self.mime_type,
            size=self.size,
            checksum_sha256_base64=self.base64,
            upload=S3FileCreateMultipart(parts=create_parts),
        )

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

    def validate_create_response(
        self, response: Response, organization_id: UUID, parts: int = 1
    ) -> FileUpload:
        assert response.status_code == 201
        data = response.json()
        valid = FileUpload(**data)

        assert valid.is_uploaded is False
        assert valid.organization_id == organization_id
        assert valid.name == self.name
        assert valid.size == self.size
        assert valid.mime_type == self.mime_type
        assert valid.checksum_sha256_base64 == self.base64
        assert valid.checksum_sha256_hex == self.hex
        assert len(valid.upload.parts) == parts
        return valid

    #####################################################################
    # UPLOAD
    #####################################################################

    async def upload(self, created: FileUpload) -> list[S3FileUploadCompletedPart]:
        completed = []
        for part in created.upload.parts:
            uploaded = await self.upload_part(
                created.upload.id,
                part=part,
            )
            completed.append(uploaded)
        return completed

    async def upload_part(
        self,
        upload_id: str,
        part: S3FileUploadPart,
    ) -> S3FileUploadCompletedPart:
        upload_url = part.url
        url = urlparse(upload_url)
        params = parse_qs(url.query)

        def p(name: str) -> str:
            return params[name][0]

        assert int(p("partNumber")) == part.number
        assert p("uploadId") == upload_id
        assert p("X-Amz-Signature")
        assert int(p("X-Amz-Expires")) == settings.S3_FILES_PRESIGN_TTL

        chunk = self.get_chunk(part)
        response = await self.put_upload(upload_url, chunk, part.headers)

        assert response.status_code == 200
        etag = response.headers.get("ETag")
        assert etag
        return S3FileUploadCompletedPart(
            number=part.number,
            checksum_etag=etag,
            checksum_sha256_base64=part.checksum_sha256_base64,
        )

    async def put_upload(
        self, upload_url: str, chunk: bytes, headers: dict[str, Any]
    ) -> Response:
        async with AsyncClient() as minio_client:
            return await minio_client.put(upload_url, content=chunk, headers=headers)

    #####################################################################
    # COMPLETE
    #####################################################################

    async def complete(
        self,
        session: AsyncSession,
        created: FileUpload,
        uploaded: list[S3FileUploadCompletedPart],
    ) -> File:
        file = await file_service.get(session, created.id)
        assert file is not None
        completed = await file_service.complete_upload(
            session,
            file=file,
            completed_schema=FileUploadCompleted(
                id=created.upload.id, path=created.path, parts=uploaded
            ),
        )

        assert completed.id == created.id
        assert completed.is_uploaded is True
        s3_service = S3_SERVICES[completed.service]
        s3_object = s3_service.get_object_or_raise(completed.path)
        metadata = s3_object["Metadata"]

        assert s3_object["ETag"] == completed.checksum_etag
        assert metadata["polar-id"] == str(completed.id)
        assert metadata["polar-organization-id"] == str(completed.organization_id)
        assert metadata["polar-name"] == completed.name
        assert metadata["polar-size"] == str(self.size)
        assert s3_object["ContentLength"] == self.size
        assert s3_object["ContentType"] == self.mime_type

        digests = []
        for part in uploaded:
            checksum_sha256_base64 = part.checksum_sha256_base64
            if checksum_sha256_base64:
                digests.append(base64.b64decode(checksum_sha256_base64))

        valid_s3_checksum = S3FileUploadCompleted.generate_base64_multipart_checksum(
            digests
        )
        # S3 stores checksums as <Checksum>-<PartCount>
        assert s3_object["ChecksumSHA256"].split("-")[0] == valid_s3_checksum
        return completed


@pytest.fixture(scope="session", autouse=True)
def empty_test_bucket(worker_id: str) -> Iterable[Any]:
    if not settings.S3_ENDPOINT_URL:
        raise RuntimeError("S3_ENDPOINT_URL not set")

    if not settings.S3_ENDPOINT_URL.startswith("http://127.0.0.1:9000"):
        raise RuntimeError("S3_ENDPOINT_URL not local development")

    if not settings.S3_FILES_BUCKET_NAME.startswith("testing"):
        raise RuntimeError("S3_FILES_BUCKET_NAME not a test bucket")

    bucket_name = f"{settings.S3_FILES_BUCKET_NAME}-{worker_id}"
    client = Minio(
        endpoint=settings.S3_ENDPOINT_URL.lstrip("http://"),
        access_key=settings.MINIO_USER,
        secret_key=settings.MINIO_PWD,
        secure=False,
    )

    if client.bucket_exists(bucket_name):
        client.remove_bucket(bucket_name)
    client.make_bucket(bucket_name)

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

    bucket = s3.Bucket(bucket_name)

    yield bucket

    bucket.object_versions.delete()
    client.remove_bucket(bucket_name)


async def uploaded_fixture(
    session: AsyncSession,
    organization: Organization,
    file: TestFile,
) -> File:
    created = await file.create(session, organization)
    uploaded = await file.upload(created)
    completed = await file.complete(session, created, uploaded)
    return completed


@pytest.fixture
def logo_png() -> TestFile:
    return TestFile("logo.png")


@pytest.fixture
def non_ascii_file_name() -> TestFile:
    return TestFile("étonnante-🦄.png")


@pytest_asyncio.fixture
async def uploaded_logo_png(session: AsyncSession, organization: Organization) -> File:
    img = TestFile("logo.png")
    return await uploaded_fixture(session, organization, img)


@pytest.fixture
def logo_jpg() -> TestFile:
    return TestFile("logo.jpg")


@pytest_asyncio.fixture
async def uploaded_logo_jpg(session: AsyncSession, organization: Organization) -> File:
    img = TestFile("logo.jpg")
    return await uploaded_fixture(session, organization, img)


@pytest.fixture
def logo_zip() -> TestFile:
    return TestFile("logo.zip")
