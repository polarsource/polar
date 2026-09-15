import pytest
from fastapi.routing import APIRoute, iter_route_contexts

from polar.api import router
from polar.kit.versioning import APIVersion
from polar.openapi import get_openapi
from polar.version import VERSIONS
from polar.void.openapi import get_void_openapi


class TestGetVoidOpenAPI:
    @pytest.mark.parametrize("version", VERSIONS)
    def test_live_contract(self, version: APIVersion) -> None:
        schema = get_void_openapi(version)

        assert schema["info"]["version"] == str(version)
        assert set(schema["paths"]) == {"/v1/void/organizations/current"}
        operation = schema["paths"]["/v1/void/organizations/current"]["get"]
        assert operation["operationId"] == "organizations:current"
        assert operation["responses"]["200"]["content"]["application/json"][
            "schema"
        ] == {"$ref": "#/components/schemas/VoidOrganization"}
        organization = schema["components"]["schemas"]["VoidOrganization"]
        assert set(organization["required"]) == {"id", "name", "slug", "created_at"}
        assert "webhooks" not in schema
        assert set(schema["components"]["securitySchemes"]) == {"oat"}
        assert operation["security"] == [
            {"oat": ["void:read"]},
            {"oat": ["void:write"]},
        ]

    def test_does_not_expose_void_in_polar_schema(self) -> None:
        contexts = tuple(iter_route_contexts(router.routes))
        void_contexts = [
            context
            for context in contexts
            if (context.path or "").startswith("/v1/void/")
        ]
        assert void_contexts
        assert all(not context.include_in_schema for context in void_contexts)

        for version in VERSIONS:
            get_void_openapi(version)
            schema = get_openapi(version, contexts, [])
            assert not any(path.startswith("/v1/void/") for path in schema["paths"])

        assert all(not context.include_in_schema for context in void_contexts)
        for context in void_contexts:
            assert isinstance(context.original_route, APIRoute)
            assert not context.original_route.include_in_schema

    def test_unsupported_version(self) -> None:
        with pytest.raises(ValueError, match="Unsupported API version"):
            get_void_openapi(APIVersion.parse("2000-01"))
