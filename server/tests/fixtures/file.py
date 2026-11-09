import base64
import hashlib
import mimetypes
from collections.abc import Iterator
from functools import cached_property
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse
from uuid import UUID

import pytest
from botocore.stub import ANY, Stubber
from httpx import Response

from polar.config import settings
from polar.file.s3 import S3_SERVICES
from polar.file.schemas import (
    DownloadableFileCreate,
    FileUpload,
    ProductMediaFileCreate,
)
from polar.file.service import file as file_service
from polar.integrations.aws.s3.client import client as s3_client
from polar.integrations.aws.s3.schemas import (
    S3FileCreateMultipart,
    S3FileCreatePart,
    S3FileUploadCompletedPart,
)
from polar.kit.utils import generate_uuid, utc_now
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
        return {
            "hex": h.hexdigest(),
            "base64": base64.b64encode(h.digest()).decode("utf-8"),
        }

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

    def stub_create(self, s3_stub: Stubber, service: FileServiceTypes) -> None:
        s3_stub.add_response(
            "create_multipart_upload",
            {"UploadId": "test-upload"},
            {
                "Bucket": S3_SERVICES[service].bucket,
                "Key": ANY,
                "ContentType": self.mime_type,
                "ChecksumAlgorithm": "SHA256",
                "Metadata": ANY,
            },
        )

    async def create(
        self,
        session: AsyncSession,
        organization: Organization,
        s3_stub: Stubber,
        parts: int = 1,
    ) -> FileUpload:
        self.stub_create(s3_stub, FileServiceTypes.downloadable)
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

    def build_product_media_create(
        self, organization_id: UUID
    ) -> ProductMediaFileCreate:
        create = self.build_create(organization_id)
        return ProductMediaFileCreate(
            service=FileServiceTypes.product_media,
            **create.model_dump(exclude={"service"}),
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

    def completed_parts(self, created: FileUpload) -> list[S3FileUploadCompletedPart]:
        completed = []
        bucket = S3_SERVICES[created.service].bucket
        for part in created.upload.parts:
            url = urlparse(part.url)
            params = parse_qs(url.query)
            assert unquote(url.path) == f"/{bucket}/{created.path}"
            assert params["partNumber"] == [str(part.number)]
            assert params["uploadId"] == [created.upload.id]
            assert params["X-Amz-Signature"][0]
            assert params["X-Amz-Expires"] == [str(settings.S3_FILES_PRESIGN_TTL)]
            assert "x-amz-checksum-sha256" in params["X-Amz-SignedHeaders"][0].split(
                ";"
            )
            assert part.headers["x-amz-checksum-sha256"] == part.checksum_sha256_base64
            completed.append(
                S3FileUploadCompletedPart(
                    number=part.number,
                    checksum_etag=f'"part-{part.number}"',
                    checksum_sha256_base64=part.checksum_sha256_base64,
                )
            )
        return completed

    def stub_complete(
        self,
        s3_stub: Stubber,
        created: FileUpload,
        parts: list[S3FileUploadCompletedPart],
    ) -> dict[str, Any]:
        checksum = hashlib.sha256(
            b"".join(
                hashlib.sha256(self.data[part.chunk_start : part.chunk_end]).digest()
                for part in created.upload.parts
            )
        )
        object_params = {
            "Bucket": S3_SERVICES[created.service].bucket,
            "Key": created.path,
        }
        s3_stub.add_response(
            "complete_multipart_upload",
            {"VersionId": "uploaded-version"},
            {
                **object_params,
                "UploadId": created.upload.id,
                "MultipartUpload": {
                    "Parts": [
                        {
                            "PartNumber": part.number,
                            "ETag": part.checksum_etag,
                            "ChecksumSHA256": part.checksum_sha256_base64,
                        }
                        for part in parts
                    ]
                },
                "ChecksumSHA256": base64.b64encode(checksum.digest()).decode(),
            },
        )
        head = {
            "ContentType": self.mime_type,
            "ContentLength": self.size,
            "ETag": '"completed-upload"',
            "LastModified": utc_now(),
            "VersionId": "uploaded-version",
            "Metadata": {
                "polar-id": str(created.id),
                "polar-organization-id": str(created.organization_id),
                "polar-name": self.name,
                "polar-size": str(created.size),
                "polar-sha256-base64": self.base64,
                "polar-sha256-hex": self.hex,
            },
        }
        s3_stub.add_response(
            "head_object", head, {**object_params, "VersionId": "uploaded-version"}
        )
        return head


@pytest.fixture(autouse=True)
def s3_stub() -> Iterator[Stubber]:
    with Stubber(s3_client) as stub:
        yield stub
        stub.assert_no_pending_responses()


async def uploaded_fixture(
    session: AsyncSession,
    organization: Organization,
    file: TestFile,
) -> File:
    file_id = generate_uuid()
    record = File(
        id=file_id,
        organization=organization,
        service=FileServiceTypes.downloadable,
        name=file.name,
        path=f"downloadable/{organization.id}/{file_id}/{file.name}",
        mime_type=file.mime_type,
        size=file.size,
        checksum_sha256_base64=file.base64,
        checksum_sha256_hex=file.hex,
        is_enabled=True,
        is_uploaded=True,
    )
    session.add(record)
    await session.flush()
    return record


@pytest.fixture
def logo_png() -> TestFile:
    return TestFile("logo.png")


@pytest.fixture
def non_ascii_file_name() -> TestFile:
    return TestFile("étonnante-🦄.png")


@pytest.fixture
async def uploaded_logo_png(session: AsyncSession, organization: Organization) -> File:
    img = TestFile("logo.png")
    return await uploaded_fixture(session, organization, img)


@pytest.fixture
def logo_jpg() -> TestFile:
    return TestFile("logo.jpg")


@pytest.fixture
async def uploaded_logo_jpg(session: AsyncSession, organization: Organization) -> File:
    img = TestFile("logo.jpg")
    return await uploaded_fixture(session, organization, img)


@pytest.fixture
def malicious_svg() -> TestFile:
    return TestFile("malicious.svg")


@pytest.fixture
def logo_zip() -> TestFile:
    return TestFile("logo.zip")
