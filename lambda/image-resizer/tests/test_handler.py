import io
from collections.abc import Iterator
from typing import Any

import boto3
import pytest
from botocore.exceptions import ClientError
from moto import mock_aws
from mypy_boto3_s3 import S3Client
from PIL import Image

import handler as handler_module
from handler import handler, is_image, resize_image, snap_to_size

BUCKET = "my-bucket"


@pytest.fixture
def aws(monkeypatch: pytest.MonkeyPatch) -> Iterator[S3Client]:
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket=BUCKET)
        monkeypatch.setattr(handler_module, "s3", client)
        yield client


def _make_event(
    uri: str = "/images/photo.jpg",
    querystring: str = "width=300",
    bucket: str = BUCKET,
) -> dict[str, Any]:
    return {
        "Records": [
            {
                "cf": {
                    "request": {
                        "uri": uri,
                        "querystring": querystring,
                        "origin": {"s3": {"domainName": f"{bucket}.s3.amazonaws.com"}},
                    }
                }
            }
        ]
    }


def _make_image(width: int = 200, height: int = 200, fmt: str = "JPEG") -> bytes:
    img = Image.new("RGB", (width, height), color="red")
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def _upload(client: S3Client, key: str, body: bytes) -> None:
    client.put_object(Bucket=BUCKET, Key=key, Body=body)


class TestSnapToSize:
    def test_rounds_up_to_nearest(self) -> None:
        assert snap_to_size(60) == 100
        assert snap_to_size(150) == 200
        assert snap_to_size(50) == 50

    def test_caps_at_max(self) -> None:
        assert snap_to_size(9999) == 2560


class TestIsImage:
    @pytest.mark.parametrize(
        "uri", ["/img.jpg", "/img.jpeg", "/img.png", "/img.gif", "/img.webp"]
    )
    def test_accepts_image_extensions(self, uri: str) -> None:
        assert is_image(uri) is True

    @pytest.mark.parametrize("uri", ["/file.pdf", "/doc.txt", "/app.js", "/no-ext"])
    def test_rejects_non_images(self, uri: str) -> None:
        assert is_image(uri) is False


class TestResizeImage:
    def test_resizes_by_width(self) -> None:
        image_bytes = _make_image(200, 200)
        result = resize_image(image_bytes, 100, None)
        assert result is not None
        img = Image.open(io.BytesIO(result))
        assert img.size[0] == 100

    def test_returns_none_when_no_downscale(self) -> None:
        image_bytes = _make_image(100, 100)
        assert resize_image(image_bytes, 200, None) is None

    def test_resizes_by_height(self) -> None:
        image_bytes = _make_image(200, 200)
        result = resize_image(image_bytes, None, 100)
        assert result is not None
        img = Image.open(io.BytesIO(result))
        assert img.size[1] == 100


class TestHandler:
    def test_passthrough_no_querystring(self) -> None:
        event = _make_event(querystring="")
        result = handler(event, None)
        assert result["uri"] == "/images/photo.jpg"
        assert result.get("querystring") == ""

    def test_passthrough_non_image(self) -> None:
        event = _make_event(uri="/files/doc.pdf", querystring="width=100")
        result = handler(event, None)
        assert result["uri"] == "/files/doc.pdf"

    def test_passthrough_invalid_params(self) -> None:
        event = _make_event(querystring="width=abc")
        result = handler(event, None)
        assert result["uri"] == "/images/photo.jpg"

    def test_passthrough_no_width_or_height(self) -> None:
        event = _make_event(querystring="format=webp")
        result = handler(event, None)
        assert result["uri"] == "/images/photo.jpg"

    def test_cache_hit(self, aws: S3Client) -> None:
        _upload(aws, "resized/100x0/images/photo.jpg", b"cached-data")

        event = _make_event(querystring="width=100")
        result = handler(event, None)

        assert result["uri"] == "/resized/100x0/images/photo.jpg"
        assert result["querystring"] == ""

    def test_cache_miss_resize_and_store(self, aws: S3Client) -> None:
        _upload(aws, "images/photo.jpg", _make_image(800, 800))

        event = _make_event(querystring="width=200")
        result = handler(event, None)

        assert result["uri"] == "/resized/200x0/images/photo.jpg"
        assert result["querystring"] == ""

        obj = aws.get_object(Bucket=BUCKET, Key="resized/200x0/images/photo.jpg")
        assert obj["ContentType"] == "image/jpeg"

        img = Image.open(io.BytesIO(obj["Body"].read()))
        assert img.size == (200, 200)

    def test_original_too_small_serves_original(self, aws: S3Client) -> None:
        _upload(aws, "images/photo.jpg", _make_image(50, 50))

        event = _make_event(querystring="width=200")
        result = handler(event, None)

        assert result["uri"] == "/images/photo.jpg"

        with pytest.raises(ClientError):
            aws.head_object(Bucket=BUCKET, Key="resized/200x0/images/photo.jpg")

    def test_s3_get_error_returns_original(self, aws: S3Client) -> None:
        event = _make_event(querystring="width=200")
        result = handler(event, None)

        assert result["uri"] == "/images/photo.jpg"

    def test_s3_head_non_404_error_returns_original(
        self, aws: S3Client, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        original_head = aws.head_object

        def head_500(**kwargs: Any) -> Any:
            raise ClientError(
                {"Error": {"Code": "500", "Message": "Internal"}}, "HeadObject"
            )

        monkeypatch.setattr(aws, "head_object", head_500)

        event = _make_event(querystring="width=200")
        result = handler(event, None)

        assert result["uri"] == "/images/photo.jpg"
        monkeypatch.setattr(aws, "head_object", original_head)
