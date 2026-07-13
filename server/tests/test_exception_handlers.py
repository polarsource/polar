import json
from typing import Any

import pytest
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError as PydanticValidationError
from pydantic_core import PydanticCustomError

from polar.exception_handlers import request_validation_exception_handler
from polar.exceptions import PolarRequestValidationError


def _dummy_request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/v1/files/",
            "headers": [],
            "query_string": b"",
        }
    )


def _request_validation_error(input_value: object) -> RequestValidationError:
    pydantic_error = PydanticValidationError.from_exception_data(
        "RequestValidationError",
        [
            {
                "type": PydanticCustomError("json_invalid", "JSON decode error"),
                "loc": ("body",),
                "input": input_value,
            }
        ],
    )
    return RequestValidationError(errors=pydantic_error.errors())


def _payload(body: Any) -> dict[str, Any]:
    return json.loads(bytes(body))


@pytest.mark.asyncio
class TestRequestValidationExceptionHandler:
    async def test_utf8_bytes_input(self) -> None:
        exc = _request_validation_error(b"not-json-but-utf8")

        response = await request_validation_exception_handler(_dummy_request(), exc)

        assert response.status_code == 422
        payload = _payload(response.body)
        assert payload["error"] == "RequestValidationError"
        assert payload["detail"][0]["input"] == "not-json-but-utf8"

    async def test_non_utf8_bytes_input(self) -> None:
        exc = _request_validation_error(b"\x89PNG\r\n\x1a\n\x00\x00\x00")

        response = await request_validation_exception_handler(_dummy_request(), exc)

        assert response.status_code == 422
        payload = _payload(response.body)
        assert payload["error"] == "RequestValidationError"
        assert isinstance(payload["detail"][0]["input"], str)

    async def test_non_utf8_bytes_nested_in_ctx(self) -> None:
        exc = _request_validation_error({"raw": b"\xff\xfe", "list": [b"\x80\x81"]})

        response = await request_validation_exception_handler(_dummy_request(), exc)

        assert response.status_code == 422
        payload = _payload(response.body)
        error = payload["detail"][0]
        assert isinstance(error["input"]["raw"], str)
        assert isinstance(error["input"]["list"][0], str)

    async def test_polar_request_validation_error_with_non_utf8_bytes(self) -> None:
        exc = PolarRequestValidationError(
            [
                {
                    "loc": ("body",),
                    "msg": "JSON decode error",
                    "type": "json_invalid",
                    "input": b"\x89PNG\r\n\x1a\n",
                }
            ]
        )

        response = await request_validation_exception_handler(_dummy_request(), exc)

        assert response.status_code == 422
        payload = _payload(response.body)
        assert payload["error"] == "PolarRequestValidationError"
        assert isinstance(payload["detail"][0]["input"], str)
