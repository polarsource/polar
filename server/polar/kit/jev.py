from pydantic_ai.models.typesafe import TypeSafeModel
from pydantic_ai.providers.typesafe import TypeSafeProvider
from typesafe_sdk import AsyncTypeSafeClient, RetryPolicy

from polar.config import settings

JEV_GATEWAY_URL = "https://gateway-us.pydantic.dev/proxy/jev"


def jev_model(*, timeout: float) -> TypeSafeModel:
    return TypeSafeModel(
        "jev-latest",
        provider=TypeSafeProvider(
            typesafe_client=AsyncTypeSafeClient(
                api_key=settings.PYDANTIC_AI_GATEWAY_API_KEY,
                base_url=JEV_GATEWAY_URL,
                compression=False,
                timeout=timeout,
                retry=RetryPolicy(max_retries=0),
            )
        ),
    )
