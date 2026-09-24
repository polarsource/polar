import json
from unittest.mock import AsyncMock

import logfire
import pytest
from fastapi import Request
from logfire.testing import CaptureLogfire
from polar.base import PolarClientError
from polar.v2026_04.errors import HTTPValidationError
from polar.v2026_04.outputs import HTTPValidationError as HTTPValidationErrorData
from polar.v2026_04.outputs import ValidationError
from pytest_mock import MockerFixture

from polar.exception_handlers import polar_exception_handler
from polar.integrations.polar.client import (
    PolarSelfClient,
    PolarSelfClientValidationError,
)


@pytest.mark.asyncio
class TestPortalValidationTelemetry:
    @pytest.mark.parametrize("operation", ["customer", "benefit_grant"])
    @pytest.mark.parametrize("structured", [True, False])
    async def test_preserves_response_without_recording_private_error_details(
        self,
        operation: str,
        structured: bool,
        capfire: CaptureLogfire,
        mocker: MockerFixture,
    ) -> None:
        field = "billing_name" if operation == "customer" else "properties"
        private_input = "sample-person@example.test"
        details = HTTPValidationErrorData(
            detail=[
                ValidationError(
                    loc=["body", field, "PRIVATE_FIELD"],
                    msg="PRIVATE_MESSAGE",
                    type="value_error",
                    input=private_input,
                ),
                ValidationError(
                    loc=["body", "PRIVATE_FIELD"],
                    msg="PRIVATE_MESSAGE",
                    type="PRIVATE_TYPE",
                    input=private_input,
                ),
            ]
        )
        sdk_error = (
            HTTPValidationError(422, details)
            if structured
            else PolarClientError(422, {"detail": private_input})
        )
        portal_sdk = AsyncMock()
        portal_sdk.customer_portal.customers.update.side_effect = sdk_error
        portal_sdk.customer_portal.benefit_grants.update.side_effect = sdk_error
        client = PolarSelfClient(access_token="test", api_url="http://test")
        mocker.patch.object(client, "_create_portal_sdk", return_value=portal_sdk)

        with pytest.raises(PolarSelfClientValidationError) as exc_info:
            with logfire.span("caller"):
                if operation == "customer":
                    await client.portal_update_customer(
                        external_customer_id="customer-123",
                        billing_name=private_input,
                    )
                else:
                    await client.portal_update_benefit_grant(
                        external_customer_id="customer-123",
                        benefit_grant_id="grant-123",
                        update={
                            "benefit_type": "slack_shared_channel",
                            "properties": {"invited_email": private_input},
                        },
                    )

        response = await polar_exception_handler(
            Request({"type": "http"}), exc_info.value
        )
        assert response.status_code == 422
        assert json.loads(bytes(response.body)) == {
            "error": "PolarSelfClientValidationError",
            "detail": str(sdk_error.error),
        }

        spans = capfire.exporter.exported_spans
        span = next(
            span
            for span in spans
            if span.name == f"polar.portal.update_{operation}" and span.events
        )
        attributes = dict(span.attributes or {})
        assert attributes["http.status_code"] == 422
        assert attributes["error.type"] == type(sdk_error).__name__
        if structured:
            assert attributes["validation.error_count"] == 2
            assert attributes["validation.fields"] == json.dumps([field])
            assert attributes["validation.error_types"] == json.dumps(["value_error"])

        telemetry = str(
            [
                (
                    dict(span.attributes or {}),
                    span.status.description,
                    [dict(event.attributes or {}) for event in span.events],
                )
                for span in spans
            ]
        )
        for private_value in (
            private_input,
            "PRIVATE_FIELD",
            "PRIVATE_MESSAGE",
            "PRIVATE_TYPE",
        ):
            assert private_value not in telemetry
        assert "Polar API request validation failed" in telemetry
