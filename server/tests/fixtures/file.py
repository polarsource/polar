import base64
import hashlib
import mimetypes
from functools import cached_property
from pathlib import Path
from typing import Any
from uuid import UUID

import pytest_asyncio

from polar.integrations.aws.s3.schemas import S3FileUploadPart

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

    def build_create_payload(self, organization_id: UUID) -> dict[str, Any]:
        return {
            "organization_id": str(organization_id),
            "name": self.name,
            "mime_type": self.mime_type,
            "size": self.size,
            "checksum_sha256_base64": self.base64,
            "upload": {
                "parts": [
                    {
                        "number": 1,
                        "chunk_start": 0,
                        "chunk_end": self.size,
                        "checksum_sha256_base64": self.base64,
                    },
                ]
            },
        }


@pytest_asyncio.fixture(scope="function")
def logo_png() -> TestFile:
    return TestFile("logo.png")


@pytest_asyncio.fixture(scope="function")
def logo_jpg() -> TestFile:
    return TestFile("logo.jpg")


@pytest_asyncio.fixture(scope="function")
def logo_zip() -> TestFile:
    return TestFile("logo.zip")
