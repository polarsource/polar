import pathlib
import re

from generator.ir import (
    APIIR,
    APIVersion,
    HTTPMethod,
    Method,
    ModelRef,
    Parameter,
    PrimitiveType,
    Service,
)
from python.emitter import PythonEmitter
from typescript.emitter import TypeScriptEmitter


def test_pending_response_widens_only_that_return_type(
    tmp_path: pathlib.Path,
) -> None:
    id_param = Parameter(
        name="id",
        parameter_name="id",
        type=PrimitiveType(kind="primitive", type="string"),
        required=True,
    )
    service = Service(
        name="Orders",
        services=[],
        methods=[
            Method(
                name="get",
                operation_id="orders:get",
                http_method=HTTPMethod.GET,
                path="/v1/orders/{id}",
                path_params=[id_param],
                query_params=[],
                response_type="json",
                response=ModelRef(kind="model", name="Order"),
            ),
            Method(
                name="receipt",
                operation_id="orders:receipt",
                description="Get a presigned URL to download an order's receipt PDF.",
                http_method=HTTPMethod.GET,
                path="/v1/orders/{id}/receipt",
                path_params=[id_param],
                query_params=[],
                response_type="json",
                response=ModelRef(kind="model", name="OrderReceipt"),
                pending_response="Receipt generation in progress.",
            ),
        ],
    )
    api = APIVersion(
        version="2026-04",
        servers=[],
        services=[service],
        input_models=[],
        output_models=[],
        webhooks=[],
        enums=[],
        input_unions=[],
        output_unions=[],
    )
    ir = APIIR(versions=[api])

    python_root = tmp_path / "python"
    PythonEmitter(ir, "1.0.2").emit(python_root)
    python = (python_root / "polar" / "v2026_04" / "services" / "orders.py").read_text()
    assert ") -> OrderReceipt | None:" in python
    assert ") -> Order:" in python
    assert ") -> Order | None:" not in python
    assert python.count("None means the receipt is still being generated.") == 2

    typescript_root = tmp_path / "typescript"
    TypeScriptEmitter(ir, "1.0.2").emit(typescript_root)
    typescript = (
        typescript_root / "src" / "2026-04" / "services" / "orders.ts"
    ).read_text()
    pending_doc = (
        "@returns {OrderReceipt | undefined} undefined means the receipt "
        "is still being generated."
    )
    assert "Promise<OrderReceipt | undefined>" in typescript
    assert "parseResponse<OrderReceipt | undefined>" in typescript
    assert pending_doc in typescript
    assert re.search(r"Promise<Order>(?!Receipt)", typescript)
    assert re.search(r"parseResponse<Order>(?!Receipt)", typescript)
    assert re.search(r"@returns \{Order\}(?!Receipt)", typescript)
    assert "Promise<Order | undefined>" not in typescript
    assert "parseResponse<Order | undefined>" not in typescript
    assert (
        typescript.count("undefined means the receipt is still being generated.") == 1
    )
