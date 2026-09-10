import json
import pathlib
import shlex
import typing

from generator.emitter import EmitterBase
from generator.ir import (
    APIIR,
    APIVersion,
    ArrayType,
    EnumRef,
    Field,
    LiteralType,
    Method,
    ModelRef,
    NullableType,
    PrimitiveType,
    TypeRef,
    UnionRef,
    UnionType,
)
from typescript.naming import exported_operation_name, operation_name

CUSTOMER_METHODS = frozenset(
    {
        "list",
        "create",
        "get",
        "update",
        "delete",
        "get_external",
        "update_external",
        "delete_external",
        "get_state",
        "get_state_external",
        "list_payment_methods",
        "list_payment_methods_external",
    }
)


class CLICommandsEmitter(EmitterBase):
    def __init__(self, ir: APIIR) -> None:
        super().__init__(ir, "0.0.0", pathlib.Path(__file__).parent / "template")

    def emit(self, root_directory: pathlib.Path | str) -> None:
        if len(self.ir.versions) != 1 or self.ir.versions[0].version != "2026-04":
            raise ValueError("The CLI prototype requires the 2026-04 OpenAPI spec.")
        api = self.ir.versions[0]
        service = next(s for s in api.services if s.name == "Customers")
        methods = sorted(
            (m for m in service.methods if m.name in CUSTOMER_METHODS),
            key=lambda m: m.name,
        )
        missing = CUSTOMER_METHODS - {m.name for m in methods}
        if missing:
            raise ValueError(f"Missing customer operations: {sorted(missing)}")

        root = self.ensure_directory(root_directory)
        commands = self.ensure_directory(root / "src" / "customers")
        for stale in commands.glob("*.ts"):
            stale.unlink()
        for name in (
            ".gitignore",
            "package.json",
            "tsconfig.json",
            "src/runtime.ts",
            "src/inputs.ts",
        ):
            self.copy_file(self.templates_dir / name, root / name)
        for method in methods:
            self.render_file(
                "src/command.ts.jinja",
                commands / f"{method.name}.ts",
                self._command_context(method, api),
            )
        self.render_file(
            "src/index.ts.jinja", root / "src" / "index.ts", {"methods": methods}
        )

    def get_version_string(self, api: APIVersion) -> str:
        return api.version

    def format_version(self) -> str:
        return self.version

    def setup_environment(self) -> None:
        self.env.filters["quote"] = json.dumps
        self.env.filters["sdk_name"] = lambda name: exported_operation_name(
            name, "Customers"
        )

    def run_post_actions(self, root_directory: pathlib.Path | str) -> None:
        clients = pathlib.Path(__file__).resolve().parents[3] / "clients"
        output = pathlib.Path(root_directory).resolve()
        self.run_command(
            f"pnpm exec oxfmt --config .oxfmtrc.json {shlex.quote(str(output))}",
            cwd=clients,
        )

    def _command_context(
        self, method: Method, api: APIVersion
    ) -> dict[str, typing.Any]:
        if method.body and method.query_params:
            raise ValueError("Mixed query and body operations are not implemented.")
        input_type = "Body" if method.body else "Query" if method.query_params else None
        fields = (
            self._body_fields(method.body, api) if method.body else method.query_params
        )
        generated_fields = [
            {
                "name": field.name,
                "description": (field.description or field.name).split("\n")[0],
                "expression": self._flag_expression(
                    field.type, field.name.replace("_", "-"), api
                ),
            }
            for field in fields
        ]
        helpers = ["production"]
        if method.http_method == "DELETE":
            helpers.append("confirm")
        if input_type:
            helpers.extend(["data", "mergeInput"])
        if any("jsonFlag(" in field["expression"] for field in generated_fields):
            helpers.append("jsonFlag")
        arguments = [f"config.{p.name}" for p in method.path_params]
        if input_type:
            arguments.append(input_type.lower())
        return {
            "api": api,
            "method": method,
            "sdk_method": operation_name(method.name),
            "input_type": input_type,
            "input_index": len(method.path_params),
            "fields": generated_fields,
            "helpers": helpers,
            "arguments": arguments,
            "description": (method.description or method.name).split("\n")[0],
        }

    def _body_fields(self, body: TypeRef, api: APIVersion) -> list[Field]:
        if isinstance(body, ModelRef):
            return next(m.fields for m in api.input_models if m.name == body.name)
        if isinstance(body, UnionRef):
            union = next(u for u in api.input_unions if u.name == body.name)
            fields: dict[str, Field] = {}
            for variant in union.variants:
                for field in self._body_fields(variant, api):
                    previous = fields.get(field.name)
                    if previous and previous.type != field.type:
                        field = field.model_copy(
                            update={
                                "type": UnionType(
                                    kind="union", variants=[previous.type, field.type]
                                )
                            }
                        )
                    fields[field.name] = field
            return list(fields.values())
        raise ValueError(f"Unsupported customer body: {body}")

    def _flag_expression(self, type_ref: TypeRef, name: str, api: APIVersion) -> str:
        quoted = json.dumps(name)
        if isinstance(type_ref, NullableType):
            return self._flag_expression(type_ref.inner, name, api)
        if isinstance(type_ref, PrimitiveType):
            constructor = {
                "string": "string",
                "integer": "integer",
                "number": "float",
                "boolean": "boolean",
            }.get(type_ref.type)
            if constructor:
                return f"Flag.{constructor}({quoted})"
        if isinstance(type_ref, EnumRef):
            enum = next(e for e in api.enums if e.name == type_ref.name)
            values = [v.value for v in enum.values]
            if all(isinstance(v, str) for v in values):
                return f"Flag.choice({quoted}, {json.dumps(values)})"
        if isinstance(type_ref, LiteralType) and isinstance(type_ref.value, str):
            return f"Flag.choice({quoted}, {json.dumps([type_ref.value])})"
        if isinstance(type_ref, ArrayType):
            item = self._flag_expression(type_ref.items, name, api)
            if not item.startswith("jsonFlag"):
                return f"{item}.pipe(Flag.atLeast(1))"
        if isinstance(type_ref, UnionType):
            variants = [
                v
                for v in type_ref.variants
                if not (isinstance(v, LiteralType) and v.value is None)
            ]
            if all(
                isinstance(v, LiteralType) and isinstance(v.value, str)
                for v in variants
            ):
                values = [v.value for v in variants if isinstance(v, LiteralType)]
                return f"Flag.choice({quoted}, {json.dumps(values)})"
            expressions = {self._flag_expression(v, name, api) for v in variants}
            if len(expressions) == 1:
                return expressions.pop()
            array = next((v for v in variants if isinstance(v, ArrayType)), None)
            if array:
                item_expression = self._flag_expression(array.items, name, api)
                array_expression = self._flag_expression(array, name, api)
                if expressions <= {item_expression, array_expression}:
                    return array_expression
        return f"jsonFlag({quoted})"
