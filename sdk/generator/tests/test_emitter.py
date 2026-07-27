import pytest

from generator.emitter import EmitterBase
from generator.ir import (
    APIIR,
    APIVersion,
    ErrorResponse,
    HTTPMethod,
    Method,
    ModelRef,
    Server,
    Service,
)
from python.emitter import PythonEmitter
from typescript.emitter import TypeScriptEmitter

type EmitterClass = type[PythonEmitter] | type[TypeScriptEmitter]

EMITTERS: list[EmitterClass] = [PythonEmitter, TypeScriptEmitter]


def _method(name: str, errors: list[ErrorResponse]) -> Method:
    return Method(
        name=name,
        operation_id=f"svc:{name}",
        http_method=HTTPMethod.PATCH,
        path=f"/{name}",
        path_params=[],
        query_params=[],
        response_type="none",
        errors=errors,
    )


def _emitter(emitter_class: EmitterClass, services: list[Service]) -> EmitterBase:
    api = APIVersion(
        version="2026-04",
        servers=[Server(environment="production", url="https://api.example.com")],
        services=services,
        input_models=[],
        output_models=[],
        webhooks=[],
        enums=[],
        input_unions=[],
        output_unions=[],
    )
    return emitter_class(APIIR(versions=[api]), version="2026-04")


def _collect(emitter: EmitterBase) -> list[ErrorResponse]:
    return emitter._collect_all_errors(emitter.ir.versions[0])


@pytest.mark.parametrize("emitter_class", EMITTERS)
def test_collect_all_errors_dedupes_identical_errors(
    emitter_class: EmitterClass,
) -> None:
    error = ErrorResponse(
        name="ResourceNotFound",
        status_code=404,
        response_type="json",
        type=ModelRef(kind="model", name="ResourceNotFound"),
    )
    emitter = _emitter(
        emitter_class,
        [
            Service(name="A", services=[], methods=[_method("get", [error])]),
            Service(name="B", services=[], methods=[_method("list", [error])]),
        ],
    )

    assert [e.name for e in _collect(emitter)] == ["ResourceNotFound"]


@pytest.mark.parametrize("emitter_class", EMITTERS)
def test_collect_all_errors_raises_on_name_collision_with_different_types(
    emitter_class: EmitterClass,
) -> None:
    def _forbidden(model: str) -> ErrorResponse:
        return ErrorResponse(
            name="Update403Error",
            status_code=403,
            response_type="json",
            type=ModelRef(kind="model", name=model),
        )

    emitter = _emitter(
        emitter_class,
        [
            Service(
                name="Checkouts",
                services=[],
                methods=[_method("update", [_forbidden("CheckoutForbidden")])],
            ),
            Service(
                name="Subscriptions",
                services=[],
                methods=[_method("update", [_forbidden("AlreadyCanceled")])],
            ),
        ],
    )

    with pytest.raises(ValueError, match="Conflicting error definitions"):
        _collect(emitter)
