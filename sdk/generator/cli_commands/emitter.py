import json
import pathlib
import shlex
import shutil
import typing

from cli_commands.confirmation import confirmation_fields
from cli_commands.preview import PreviewOperation, preview_fields
from generator.casing import to_snake_case
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
    Service,
    TypeRef,
    UnionRef,
    UnionType,
)
from typescript.naming import exported_operation_name, operation_name, service_name


class CLICommandsEmitter(EmitterBase):
    def __init__(self, ir: APIIR) -> None:
        super().__init__(ir, "0.0.0", pathlib.Path(__file__).parent / "template")

    def emit(self, root_directory: pathlib.Path | str) -> None:
        if len(self.ir.versions) != 1 or self.ir.versions[0].version != "2026-04":
            raise ValueError("The CLI prototype requires the 2026-04 OpenAPI spec.")

        api = self.ir.versions[0]
        services = sorted(api.services, key=lambda service: service.name)
        if not services:
            raise ValueError("No CLI services to emit.")

        previews = self._preview_operations(services, api)

        root = self.ensure_directory(root_directory)
        src = self.ensure_directory(root / "src")

        for stale in src.iterdir():
            if stale.is_dir():
                shutil.rmtree(stale)

        for name in (
            ".gitignore",
            "package.json",
            "tsconfig.json",
            "src/runtime.ts",
            "src/inputs.ts",
        ):
            self.copy_file(self.templates_dir / name, root / name)

        for service in services:
            self._emit_service(service, api, src, [], previews)

        self.render_file("src/index.ts.jinja", src / "index.ts", {"services": services})

    def get_version_string(self, api: APIVersion) -> str:
        return api.version

    def format_version(self) -> str:
        return self.version

    def setup_environment(self) -> None:
        self.env.filters["quote"] = json.dumps
        self.env.filters["sdk_name"] = exported_operation_name
        self.env.filters["service_name"] = service_name
        self.env.filters["snake"] = to_snake_case

    def run_post_actions(self, root_directory: pathlib.Path | str) -> None:
        clients = pathlib.Path(__file__).resolve().parents[3] / "clients"
        output = pathlib.Path(root_directory).resolve()

        self.run_command(
            f"pnpm exec oxfmt --config .oxfmtrc.json {shlex.quote(str(output))}",
            cwd=clients,
        )

    def _emit_service(
        self,
        service: Service,
        api: APIVersion,
        parent: pathlib.Path,
        ancestors: list[str],
        previews: dict[str, PreviewOperation],
    ) -> None:
        directory = self.ensure_directory(parent / to_snake_case(service.name))
        path = [*ancestors, service_name(service.name)]
        methods = sorted(service.methods, key=lambda method: method.name)
        children = sorted(service.services, key=lambda child: child.name)

        for method in methods:
            context = self._command_context(method, api, path)

            self.render_file(
                "src/command.ts.jinja",
                directory / f"{method.name}.ts",
                {
                    **context,
                    "preview": previews.get(method.path)
                    if context["needs_confirmation"]
                    else None,
                },
            )

        for child in children:
            self._emit_service(child, api, directory, path, previews)

        self.render_file(
            "src/service.ts.jinja",
            directory / "index.ts",
            {"service": service, "methods": methods, "children": children},
        )

    def _preview_operations(
        self, services: list[Service], api: APIVersion, ancestors: tuple[str, ...] = ()
    ) -> dict[str, PreviewOperation]:
        previews: dict[str, PreviewOperation] = {}

        for service in services:
            path = (*ancestors, service_name(service.name))

            for method in service.methods:
                if (
                    method.http_method == "GET"
                    and method.response_type == "json"
                    and method.body is None
                    and not any(
                        p.required or p.cli_confirm for p in method.query_params
                    )
                ):
                    arguments = ", ".join(
                        f"config.path.{p.name}" for p in method.path_params
                    )
                    previews[method.path] = {
                        "invoke": f"client.{'.'.join(path)}.{operation_name(method.name)}({arguments})",
                        "fields": preview_fields(method, api),
                    }

            previews.update(self._preview_operations(service.services, api, path))

        return previews

    def _command_context(
        self, method: Method, api: APIVersion, service_path: list[str]
    ) -> dict[str, typing.Any]:
        if method.body and method.query_params:
            raise ValueError("Mixed query and body operations are not implemented.")

        if method.body:
            input_type = "Body"
            fields = self._body_fields(method.body, api)
        elif method.query_params:
            input_type = "Query"
            fields = method.query_params
        else:
            input_type = None
            fields = []

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

        conditions = (
            [] if method.http_method == "DELETE" else confirmation_fields(fields, api)
        )
        needs_confirmation = method.http_method == "DELETE" or bool(conditions)

        if method.http_method == "DELETE":
            confirmation_expression = "true"
        else:
            confirmation_expression = (
                " || ".join(
                    f"confirmationInput[{json.dumps(field['key'])}] === {json.dumps(field['equals'])}"
                    for field in conditions
                )
                or "false"
            )

        helpers = []
        if needs_confirmation:
            helpers.append("confirm")

        if input_type:
            helpers.extend(["data", "mergeInput"])

        if any("jsonFlag(" in field["expression"] for field in generated_fields):
            helpers.append("jsonFlag")

        arguments = [f"config.path.{p.name}" for p in method.path_params]
        if input_type:
            arguments.append(input_type.lower())

        return {
            "api": api,
            "method": method,
            "sdk_method": operation_name(method.name),
            "sdk_service": ".".join(service_path),
            "sdk_type": "Polar" + "".join(f"[{json.dumps(p)}]" for p in service_path),
            "runtime_path": "../" * len(service_path),
            "input_type": input_type,
            "input_index": len(method.path_params),
            "fields": generated_fields,
            "helpers": helpers,
            "confirmation_fields": conditions,
            "needs_confirmation": needs_confirmation,
            "confirmation_expression": confirmation_expression,
            "arguments": arguments,
            "description": (method.description or method.name).split("\n")[0],
        }

    def _body_fields(self, body: TypeRef, api: APIVersion) -> list[Field]:
        if isinstance(body, ModelRef):
            return next(m.fields for m in api.input_models if m.name == body.name)

        if isinstance(body, (UnionRef, UnionType)):
            union = (
                next(u for u in api.input_unions if u.name == body.name)
                if isinstance(body, UnionRef)
                else body
            )

            fields: dict[str, Field] = {}
            for variant in union.variants:
                for field in self._body_fields(variant, api):
                    previous = fields.get(field.name)
                    if previous and previous.cli_confirm:
                        if (
                            field.cli_confirm
                            and previous.cli_confirm.model_dump_json()
                            != field.cli_confirm.model_dump_json()
                        ):
                            raise ValueError(
                                f"Conflicting CLI confirmation rules for {field.name!r}"
                            )

                        field = field.model_copy(
                            update={"cli_confirm": previous.cli_confirm}
                        )

                    if previous and previous.type != field.type:
                        variants: list[TypeRef] = (
                            previous.type.variants
                            if isinstance(previous.type, UnionType)
                            else [previous.type]
                        )

                        if field.type not in variants:
                            variants = [*variants, field.type]

                        field = field.model_copy(
                            update={"type": UnionType(kind="union", variants=variants)}
                        )

                    fields[field.name] = field

            return list(fields.values())

        raise ValueError(f"Unsupported request body: {body}")

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
