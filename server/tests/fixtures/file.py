import base64
import hashlib
import mimetypes
from functools import cached_property
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse
from uuid import UUID

import boto3
import pytest_asyncio
from botocore.config import Config
from httpx import AsyncClient, Response

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.file.s3 import S3_SERVICES
from polar.file.schemas import (
    DownloadableFileCreate,
    FileRead,
    FileReadAdapter,
    FileUpload,
    FileUploadCompleted,
)
from polar.integrations.aws.s3.schemas import (
    S3FileCreateMultipart,
    S3FileCreatePart,
    S3FileUploadCompleted,
    S3FileUploadCompletedPart,
    S3FileUploadPart,
)
from polar.models import Organization, User, UserOrganization
from polar.models.file import FileServiceTypes

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
        self, client: AsyncClient, organization_id: UUID, parts: int = 1
    ) -> FileUpload:
        response = await client.post(
            "/v1/files/",
            json=self.build_create_json(organization_id, parts=parts),
        )
        return self.validate_create_response(response, organization_id)

    def build_create_json(
        self, organization_id: UUID, parts: int = 1
    ) -> dict[str, Any]:
        create_parts = []
        for i in range(parts):
            part = self.build_create_part(i + 1, parts)
            create_parts.append(part)

        create = DownloadableFileCreate(
            service=FileServiceTypes.downloadable,
            organization_id=organization_id,
            name=self.name,
            mime_type=self.mime_type,
            size=self.size,
            checksum_sha256_base64=self.base64,
            upload=S3FileCreateMultipart(parts=create_parts),
        )
        data = create.model_dump(mode="json")
        return data

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
        assert response.status_code == 200
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
        client: AsyncClient,
        created: FileUpload,
        uploaded: list[S3FileUploadCompletedPart],
    ) -> FileRead:
        payload = FileUploadCompleted(
            id=created.upload.id, path=created.path, parts=uploaded
        )
        payload_json = payload.model_dump(mode="json")

        response = await client.post(
            f"/v1/files/{created.id}/uploaded",
            json=payload_json,
        )

        assert response.status_code == 200
        data = response.json()
        completed = FileReadAdapter.validate_python(data)

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


async def uploaded_fixture(
    client: AsyncClient,
    organization_id: UUID,
    file: TestFile,
) -> FileRead:
    created = await file.create(client, organization_id)
    uploaded = await file.upload(created)
    completed = await file.complete(client, created, uploaded)
    return completed


@pytest_asyncio.fixture(scope="function")
def logo_png() -> TestFile:
    return TestFile("logo.png")


@pytest_asyncio.fixture(scope="function")
def non_ascii_file_name() -> TestFile:
    return TestFile("étonnante-🦄.png")


@pytest_asyncio.fixture(scope="function")
async def uploaded_logo_png(
    client: AsyncClient,
    auth_subject: AuthSubject[User],
    user_organization: UserOrganization,
    organization: Organization,
) -> FileRead:
    img = TestFile("logo.png")
    return await uploaded_fixture(client, user_organization.organization_id, img)


@pytest_asyncio.fixture(scope="function")
def logo_jpg() -> TestFile:
    return TestFile("logo.jpg")


@pytest_asyncio.fixture(scope="function")
async def uploaded_logo_jpg(
    client: AsyncClient,
    auth_subject: AuthSubject[User],
    user_organization: UserOrganization,
    organization: Organization,
) -> FileRead:
    img = TestFile("logo.jpg")
    return await uploaded_fixture(client, user_organization.organization_id, img)


@pytest_asyncio.fixture(scope="function")
def logo_zip() -> TestFile:
    return TestFile("logo.zip")
