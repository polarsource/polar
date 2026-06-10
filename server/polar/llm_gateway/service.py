import builtins
import uuid
from collections.abc import AsyncIterator, Sequence
from decimal import Decimal
from typing import Any

import structlog

from dataclasses import dataclass

from polar.auth.models import AuthSubject, Organization, User, is_organization
from polar.authz.service import get_accessible_org_ids
from polar.exceptions import PolarError
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models.llm_provider_config import LLMProviderConfig
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncReadSession, AsyncSession

from .crypto import decrypt_api_key, encrypt_api_key
from .repository import LLMProviderConfigRepository
from .schemas import LLMProviderConfigCreate, LLMProviderConfigUpdate
from .sorting import LLMProviderConfigSortProperty

log = structlog.get_logger()

@dataclass(frozen=True, slots=True)
class PolarContext:
    """Polar-specific attributes extracted from X-Polar-* request headers.

    Usage with the OpenAI SDK::

        client.chat.completions.create(
            model="gpt-4o",
            messages=[...],
            extra_headers={
                "X-Polar-Customer-Id": "<polar-customer-uuid>",
                "X-Polar-External-Customer-Id": "cust_123",
                "X-Polar-Parent-Id": "<event-id-or-external-id>",
            },
        )
    """

    customer_id: uuid.UUID | None = None
    external_customer_id: str | None = None
    external_id: str | None = None
    parent_id: str | None = None


def extract_polar_context(headers: Any) -> PolarContext:
    """Build a PolarContext from X-Polar-* request headers."""
    raw_customer_id = headers.get("x-polar-customer-id")
    customer_id: uuid.UUID | None = None
    if raw_customer_id is not None:
        try:
            customer_id = uuid.UUID(str(raw_customer_id))
        except ValueError:
            raise PolarError("'X-Polar-Customer-Id' must be a valid UUID.", 400)

    return PolarContext(
        customer_id=customer_id,
        external_customer_id=headers.get("x-polar-external-customer-id"),
        external_id=headers.get("x-polar-external-id"),
        parent_id=headers.get("x-polar-parent-id"),
    )


class LLMGatewayError(PolarError): ...


class ModelNotFoundError(LLMGatewayError):
    def __init__(self, model: str) -> None:
        self.model = model
        super().__init__(f"Model '{model}' is not configured or not enabled.", 404)


class LLMGatewayService:
    # --- Config CRUD ---

    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[LLMProviderConfigSortProperty]] = [
            (LLMProviderConfigSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[LLMProviderConfig], int]:
        repository = LLMProviderConfigRepository.from_session(session)
        org_ids = await get_accessible_org_ids(session, auth_subject)
        statement = repository.get_statement_by_org_ids(org_ids)

        if organization_id is not None:
            statement = statement.where(
                LLMProviderConfig.organization_id.in_(organization_id)
            )

        return await repository.paginate(statement, limit=pagination.limit, page=pagination.page)

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> LLMProviderConfig | None:
        repository = LLMProviderConfigRepository.from_session(session)
        org_ids = await get_accessible_org_ids(session, auth_subject)
        return await repository.get_readable_by_id(id, org_ids)

    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        create_schema: LLMProviderConfigCreate,
    ) -> LLMProviderConfig:
        organization = await get_payload_organization(
            session, auth_subject, create_schema
        )

        encrypted_key = encrypt_api_key(create_schema.api_key)

        repository = LLMProviderConfigRepository.from_session(session)
        config = await repository.create(
            LLMProviderConfig(
                organization_id=organization.id,
                provider=create_schema.provider,
                model_name=create_schema.model_name,
                display_name=create_schema.display_name,
                api_key_encrypted=encrypted_key,
                is_enabled=True,
            ),
            flush=True,
        )

        log.info(
            "llm_gateway.config_created",
            config_id=str(config.id),
            organization_id=str(organization.id),
            provider=config.provider,
            model_name=config.model_name,
        )

        return config

    async def update(
        self,
        session: AsyncSession,
        config: LLMProviderConfig,
        update_schema: LLMProviderConfigUpdate,
    ) -> LLMProviderConfig:
        repository = LLMProviderConfigRepository.from_session(session)

        update_dict: dict[str, Any] = {}
        if update_schema.display_name is not None:
            update_dict["display_name"] = update_schema.display_name
        if update_schema.is_enabled is not None:
            update_dict["is_enabled"] = update_schema.is_enabled
        if update_schema.api_key is not None:
            update_dict["api_key_encrypted"] = encrypt_api_key(update_schema.api_key)

        if update_dict:
            config = await repository.update(config, update_dict=update_dict)

        return config

    async def delete(
        self,
        session: AsyncSession,
        config: LLMProviderConfig,
    ) -> LLMProviderConfig:
        repository = LLMProviderConfigRepository.from_session(session)
        config.set_deleted_at()
        await session.flush()
        return config

    # --- Proxy ---

    async def resolve_config(
        self,
        session: AsyncReadSession,
        organization_id: uuid.UUID,
        model: str,
    ) -> LLMProviderConfig:
        repository = LLMProviderConfigRepository.from_session(session)
        config = await repository.get_by_org_and_model(organization_id, model)
        if config is None:
            raise ModelNotFoundError(model)
        return config

    def get_decrypted_key(self, config: LLMProviderConfig) -> str:
        return decrypt_api_key(config.api_key_encrypted)

    async def chat_completion(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        request_body: dict[str, Any],
        polar_ctx: PolarContext | None = None,
    ) -> dict[str, Any]:
        import litellm

        organization_id = await self._resolve_org_id(session, auth_subject)

        model = request_body.get("model")
        if not model:
            raise PolarError("'model' is required.", 400)

        config = await self.resolve_config(session, organization_id, model)
        api_key = self.get_decrypted_key(config)

        litellm_model = f"{config.provider}/{config.model_name}"

        prompt = self._extract_prompt(request_body)

        response = await litellm.acompletion(
            model=litellm_model,
            api_key=api_key,
            **{k: v for k, v in request_body.items() if k != "model" and k != "stream"},
            stream=False,
        )

        await self._emit_usage_event(
            session, auth_subject, organization_id, config, response,
            prompt=prompt,
            polar_ctx=polar_ctx or PolarContext(),
        )

        return response.model_dump()

    async def chat_completion_stream(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        request_body: dict[str, Any],
        polar_ctx: PolarContext | None = None,
    ) -> AsyncIterator[str]:
        import litellm

        organization_id = await self._resolve_org_id(session, auth_subject)

        model = request_body.get("model")
        if not model:
            raise PolarError("'model' is required.", 400)

        config = await self.resolve_config(session, organization_id, model)
        api_key = self.get_decrypted_key(config)

        litellm_model = f"{config.provider}/{config.model_name}"
        prompt = self._extract_prompt(request_body)

        response = await litellm.acompletion(
            model=litellm_model,
            api_key=api_key,
            **{k: v for k, v in request_body.items() if k != "model" and k != "stream"},
            stream=True,
        )

        usage_data: dict[str, int] = {}
        async for chunk in response:
            chunk_dict = chunk.model_dump()
            # Capture usage from the final chunk
            if chunk_dict.get("usage"):
                usage_data = chunk_dict["usage"]
            yield f"data: {chunk.model_dump_json()}\n\n"

        yield "data: [DONE]\n\n"

        # Emit usage event after stream completes
        if usage_data:
            cost_cents = self._compute_cost_from_tokens(
                config, usage_data
            )
            await self._emit_usage_event_from_usage(
                session, auth_subject, organization_id, config, usage_data,
                cost_cents=cost_cents,
                prompt=prompt,
                polar_ctx=polar_ctx or PolarContext(),
            )

    async def list_models(
        self,
        session: AsyncReadSession,
        organization_id: uuid.UUID,
    ) -> builtins.list[dict[str, Any]]:
        repository = LLMProviderConfigRepository.from_session(session)
        configs = await repository.get_enabled_by_org(organization_id)

        return [
            {
                "id": config.display_name or config.model_name,
                "object": "model",
                "created": int(config.created_at.timestamp()),
                "owned_by": config.provider,
            }
            for config in configs
        ]

    # --- Internal helpers ---

    async def _resolve_org_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
    ) -> uuid.UUID:
        if is_organization(auth_subject):
            return auth_subject.subject.id

        # For user auth, we need an organization_id header or query param
        # For now, get the first accessible org
        org_ids = await get_accessible_org_ids(session, auth_subject)
        if not org_ids:
            raise PolarError("No accessible organization found.", 403)
        return next(iter(org_ids))

    def _compute_cost_cents(
        self, config: LLMProviderConfig, response: Any
    ) -> Decimal | None:
        import litellm

        try:
            cost_dollars = litellm.completion_cost(
                completion_response=response,
                model=f"{config.provider}/{config.model_name}",
            )
            if cost_dollars and cost_dollars > 0:
                return Decimal(str(cost_dollars)) * 100  # dollars -> cents
        except Exception:
            log.debug(
                "llm_gateway.cost_calculation_failed",
                provider=config.provider,
                model=config.model_name,
                exc_info=True,
            )
        return None

    def _compute_cost_from_tokens(
        self, config: LLMProviderConfig, usage: dict[str, int]
    ) -> Decimal | None:
        import litellm

        try:
            prompt_cost, compl_cost = litellm.cost_per_token(
                model=f"{config.provider}/{config.model_name}",
                prompt_tokens=usage.get("prompt_tokens", 0) or 0,
                completion_tokens=usage.get("completion_tokens", 0) or 0,
            )
            total_dollars = prompt_cost + compl_cost
            if total_dollars > 0:
                return Decimal(str(total_dollars)) * 100  # dollars -> cents
        except Exception:
            log.debug(
                "llm_gateway.stream_cost_calculation_failed",
                provider=config.provider,
                model=config.model_name,
                exc_info=True,
            )
        return None

    @staticmethod
    def _extract_prompt(request_body: dict[str, Any]) -> str | None:
        messages = request_body.get("messages")
        if not messages or not isinstance(messages, list):
            return None
        # Find the last user message
        for msg in reversed(messages):
            if isinstance(msg, dict) and msg.get("role") == "user":
                content = msg.get("content")
                if isinstance(content, str):
                    return content
                # Handle content arrays (e.g. vision messages)
                if isinstance(content, list):
                    text_parts = [
                        p.get("text", "")
                        for p in content
                        if isinstance(p, dict) and p.get("type") == "text"
                    ]
                    if text_parts:
                        return "\n".join(text_parts)
        return None

    async def _emit_usage_event(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization_id: uuid.UUID,
        config: LLMProviderConfig,
        response: Any,
        *,
        prompt: str | None = None,
        polar_ctx: PolarContext = PolarContext(),
    ) -> None:
        usage = getattr(response, "usage", None)
        if usage is None:
            return

        usage_dict = {
            "prompt_tokens": getattr(usage, "prompt_tokens", 0) or 0,
            "completion_tokens": getattr(usage, "completion_tokens", 0) or 0,
            "total_tokens": getattr(usage, "total_tokens", 0) or 0,
        }
        cost_cents = self._compute_cost_cents(config, response)
        await self._emit_usage_event_from_usage(
            session, auth_subject, organization_id, config, usage_dict,
            cost_cents=cost_cents,
            prompt=prompt,
            polar_ctx=polar_ctx,
        )

    async def _emit_usage_event_from_usage(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization_id: uuid.UUID,
        config: LLMProviderConfig,
        usage: dict[str, int],
        *,
        cost_cents: Decimal | None = None,
        prompt: str | None = None,
        polar_ctx: PolarContext = PolarContext(),
    ) -> None:
        from polar.event.schemas import (
            EventCreate,
            EventCreateCustomer,
            EventCreateExternalCustomer,
            EventsIngest,
        )
        from polar.event.service import event as event_service

        prompt_tokens = usage.get("prompt_tokens", 0) or 0
        completion_tokens = usage.get("completion_tokens", 0) or 0
        total_tokens = usage.get("total_tokens", 0) or 0

        metadata: dict[str, Any] = {
            "_llm": {
                "vendor": config.provider,
                "model": config.model_name,
                "prompt": prompt,
                "response": None,
                "input_tokens": prompt_tokens,
                "output_tokens": completion_tokens,
                "total_tokens": total_tokens,
            },
        }
        if cost_cents is not None:
            metadata["_cost"] = {
                "amount": cost_cents,
                "currency": "usd",
            }

        org_id_field = organization_id if not is_organization(auth_subject) else None

        event: EventCreate
        if polar_ctx.customer_id is not None:
            event = EventCreateCustomer(
                name="llm.completion",
                organization_id=org_id_field,
                customer_id=polar_ctx.customer_id,
                external_id=polar_ctx.external_id,
                parent_id=polar_ctx.parent_id,
                metadata=metadata,
            )
        else:
            external_customer_id = (
                polar_ctx.external_customer_id
                or f"llm_gateway_{organization_id}"
            )
            event = EventCreateExternalCustomer(
                name="llm.completion",
                organization_id=org_id_field,
                external_customer_id=external_customer_id,
                external_id=polar_ctx.external_id,
                parent_id=polar_ctx.parent_id,
                metadata=metadata,
            )

        try:
            await event_service.ingest(
                session, auth_subject, EventsIngest(events=[event])
            )
            await self._notify_event_ingested(organization_id, config)
        except Exception:
            log.warning(
                "llm_gateway.usage_event_failed",
                organization_id=str(organization_id),
                provider=config.provider,
                model=config.model_name,
                exc_info=True,
            )


    async def _notify_event_ingested(
        self,
        organization_id: uuid.UUID,
        config: LLMProviderConfig,
    ) -> None:
        from polar.eventstream.service import publish

        await publish(
            key="event.ingested",
            payload={
                "provider": config.provider,
                "model": config.model_name,
            },
            organization_id=organization_id,
        )


llm_gateway = LLMGatewayService()
