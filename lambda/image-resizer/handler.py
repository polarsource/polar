import io
import logging
from typing import Any
from urllib.parse import parse_qs, urlparse

import boto3
from botocore.exceptions import ClientError
from PIL import Image
from PIL.Image import Resampling

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ALLOWED_SIZES = [50, 100, 200, 400, 800, 1200, 1920, 2560]
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}

s3 = boto3.client("s3")


def snap_to_size(value: int) -> int:
    for size in ALLOWED_SIZES:
        if size >= value:
            return size
    return ALLOWED_SIZES[-1]


def get_bucket_from_origin(request: dict[str, Any]) -> str | None:
    origin = request.get("origin", {})
    for origin_type in ("s3", "custom"):
        domain = origin.get(origin_type, {}).get("domainName", "")
        if domain:
            return domain.split(".")[0]
    return None


def is_image(uri: str) -> bool:
    path = urlparse(uri).path.lower()
    return any(path.endswith(ext) for ext in IMAGE_EXTENSIONS)


def get_content_type(key: str) -> str:
    lower = key.lower()
    for ext, ct in CONTENT_TYPES.items():
        if lower.endswith(ext):
            return ct
    return "application/octet-stream"


def resize_image(
    image_bytes: bytes, width: int | None, height: int | None
) -> bytes | None:
    img = Image.open(io.BytesIO(image_bytes))
    orig_format = img.format
    orig_w, orig_h = img.size

    if width and width >= orig_w and not height:
        return None
    if height and height >= orig_h and not width:
        return None
    if width and height and width >= orig_w and height >= orig_h:
        return None

    if width and height:
        img.thumbnail((width, height), Resampling.LANCZOS)
    elif width:
        ratio = width / orig_w
        img = img.resize((width, int(orig_h * ratio)), Resampling.LANCZOS)
    elif height:
        ratio = height / orig_h
        img = img.resize((int(orig_w * ratio), height), Resampling.LANCZOS)

    buf = io.BytesIO()
    fmt = orig_format or "JPEG"
    save_kwargs: dict[str, Any] = {}
    if fmt.upper() in ("JPEG", "JPG"):
        fmt = "JPEG"
        save_kwargs["quality"] = 85
    elif fmt.upper() == "WEBP":
        save_kwargs["quality"] = 85
    elif fmt.upper() == "PNG":
        save_kwargs["optimize"] = True

    img.save(buf, format=fmt, **save_kwargs)
    return buf.getvalue()


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    request: dict[str, Any] = event["Records"][0]["cf"]["request"]
    uri: str = request["uri"]
    querystring: str = request.get("querystring", "")

    logger.info("uri=%s querystring=%s", uri, querystring)

    if not querystring or not is_image(uri):
        return request

    params = parse_qs(querystring)
    width_str = params.get("width", [None])[0]
    height_str = params.get("height", [None])[0]

    if not width_str and not height_str:
        return request

    try:
        width = snap_to_size(int(width_str)) if width_str else 0
        height = snap_to_size(int(height_str)) if height_str else 0
    except (ValueError, TypeError):
        return request

    if width <= 0 and height <= 0:
        return request

    bucket = get_bucket_from_origin(request)
    if not bucket:
        logger.error("Could not determine bucket from origin")
        return request

    original_key = uri.lstrip("/")
    resized_key = f"resized/{width}x{height}/{original_key}"

    try:
        s3.head_object(Bucket=bucket, Key=resized_key)
        request["uri"] = f"/{resized_key}"
        request["querystring"] = ""
        return request
    except ClientError as e:
        if e.response["Error"]["Code"] != "404":
            logger.error("Error checking resized object: %s", e)
            return request

    try:
        response = s3.get_object(Bucket=bucket, Key=original_key)
        original_bytes: bytes = response["Body"].read()
    except ClientError as e:
        logger.error("Error fetching original: %s", e)
        return request

    try:
        resized_bytes = resize_image(
            original_bytes, width if width > 0 else None, height if height > 0 else None
        )
    except Exception:
        logger.exception("Error resizing image")
        return request

    if resized_bytes is None:
        return request

    try:
        s3.put_object(
            Bucket=bucket,
            Key=resized_key,
            Body=resized_bytes,
            ContentType=get_content_type(original_key),
            CacheControl="public, max-age=2592000",
        )
    except ClientError:
        logger.exception("Error storing resized image")
        return request

    request["uri"] = f"/{resized_key}"
    request["querystring"] = ""
    return request
