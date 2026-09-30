import dataclasses
import json
import pathlib
import re
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
    MapType,
    Method,
    ModelRef,
    NullableType,
    Parameter,
    PrimitiveType,
    Service,
    TypeRef,
    UnionRef,
    UnionType,
)
from typescript.naming import exported_operation_name, operation_name, service_name

JSON_SHAPE_DEPTH = 2
JSON_SHAPE_ENUM_VALUES = 5
NULLABLE = " | null"
EXAMPLE_DEPTH = 6


@dataclasses.dataclass(frozen=True)
class Placeholder:
    name: str
    quoted: bool


class CLICommandsEmitter(EmitterBase):
    def __init__(self, ir: APIIR, version: str) -> None:
        super().__init__(ir, version, pathlib.Path(__file__).parent / "template")

    def emit(self, root_directory: pathlib.Path | str) -> None:
        if len(self.ir.versions) != 1:
            raise ValueError(
                "CLI commands are generated from exactly one OpenAPI spec."
            )

        api = self.ir.versions[0]
        services = sorted(api.services, key=lambda service: service.name)
        if not services:
            raise ValueError(
                "No public CLI-tagged operations found. Regenerate OpenAPI from the "
                "backend with APITag.cli annotations before generating commands."
            )

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
            "src/inputs.ts",
        ):
            self.copy_file(self.templates_dir / name, root / name)

        self.render_file("src/runtime.ts", src / "runtime.ts", {"api": api})

        for service in services:
            self._emit_service(service, api, src, [], previews)

        self.render_file("src/index.ts", src / "index.ts", {"services": services})

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
        command_ancestors: tuple[str, ...] = (),
    ) -> None:
        directory = self.ensure_directory(parent / to_snake_case(service.name))
        path = [*ancestors, service_name(service.name)]
        command_path = (*command_ancestors, to_snake_case(service.name))
        methods = sorted(service.methods, key=lambda method: method.name)
        children = sorted(service.services, key=lambda child: child.name)

        for method in methods:
            context = self._command_context(method, api, path, command_path)

            self.render_file(
                "src/command.ts",
                directory / f"{method.name}.ts",
                {
                    **context,
                    "preview": previews.get(method.path)
                    if context["needs_confirmation"]
                    and method.http_method in ("DELETE", "PATCH", "PUT")
                    else None,
                },
            )

        for child in children:
            self._emit_service(child, api, directory, path, previews, command_path)

        self.render_file(
            "src/service.ts",
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
        self,
        method: Method,
        api: APIVersion,
        service_path: list[str],
        command_path: tuple[str, ...],
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

        required = [field for field in fields if field.required]
        example = " ".join(
            [
                "polar",
                *command_path,
                method.name,
                *(f"<{p.name}>" for p in method.path_params),
                *(self._example_flag(field, api) for field in required),
            ]
        )

        generated_fields = []
        for field in fields:
            expression = self._flag_expression(
                field.type, field.name.replace("_", "-"), api
            )
            generated_fields.append(
                {
                    "name": field.name,
                    "description": self._flag_description(
                        field,
                        api,
                        required=field.required,
                        json=expression.startswith("jsonFlag("),
                    ),
                    "expression": expression,
                }
            )

        always_confirm = method.http_method == "DELETE" or method.cli_confirm is True
        conditions = [] if always_confirm else confirmation_fields(fields, api)
        needs_confirmation = always_confirm or bool(conditions)

        if always_confirm:
            confirmation_expression = "true"
        else:
            confirmation_expression = (
                " || ".join(
                    f"confirmationInput[{json.dumps(field['key'])}] === {json.dumps(value)}"
                    for field in conditions
                    for value in field["values"]
                )
                or "false"
            )

        helpers = []
        if needs_confirmation:
            helpers.append("confirm")

        if input_type:
            helpers.extend(["data", "mergeInput"])

        if required:
            helpers.append("missingFlags")

        if any("jsonFlag(" in field["expression"] for field in generated_fields):
            helpers.append("jsonFlag")

        if any(
            "nullableStringFlag(" in field["expression"] for field in generated_fields
        ):
            helpers.append("nullableStringFlag")

        has_organization = any(field.name == "organization_id" for field in fields)
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
            "required": [field.name for field in required],
            "example": example,
            "has_organization": has_organization,
            "input_index": len(method.path_params),
            "fields": generated_fields,
            "helpers": helpers,
            "confirmation_fields": conditions,
            "needs_confirmation": needs_confirmation,
            "confirmation_expression": confirmation_expression,
            "arguments": arguments,
            "description": (method.description or method.name).split("\n")[0],
        }

    def _example_flag(self, field: Field | Parameter, api: APIVersion) -> str:
        flag = field.name.replace("_", "-")
        value = (
            field.example
            if field.has_example
            else self._example_value(field.type, api, flag)
        )
        expression = self._flag_expression(field.type, flag, api)
        if expression.startswith("jsonFlag("):
            return f"--{flag} {shlex.quote(self._example_json(value))}"
        if isinstance(value, list):
            value = value[0]
        if isinstance(value, Placeholder):
            return f"--{flag} <{value.name}>"
        return f"--{flag} {shlex.quote(str(value))}"

    def _example_value(
        self, type_ref: TypeRef, api: APIVersion, name: str, depth: int = 0
    ) -> typing.Any:
        if isinstance(type_ref, NullableType):
            return self._example_value(type_ref.inner, api, name, depth)

        if isinstance(type_ref, LiteralType):
            return type_ref.value

        if isinstance(type_ref, EnumRef):
            enum = next(e for e in api.enums if e.name == type_ref.name)
            return enum.values[0].value

        if isinstance(type_ref, PrimitiveType) and type_ref.type == "boolean":
            return True

        if depth < EXAMPLE_DEPTH:
            if isinstance(type_ref, ArrayType):
                return [self._example_value(type_ref.items, api, name, depth + 1)]

            if isinstance(type_ref, MapType):
                value = self._example_value(
                    type_ref.value_type, api, "value", depth + 1
                )
                return {"<key>": value}

            if isinstance(type_ref, ModelRef):
                model = next(m for m in api.input_models if m.name == type_ref.name)
                return {
                    f.name: f.example
                    if f.has_example
                    else self._example_value(f.type, api, f.name, depth + 1)
                    for f in model.fields
                    if f.required or isinstance(f.type, LiteralType)
                }

            if isinstance(type_ref, (UnionRef, UnionType)):
                union = (
                    next(u for u in api.input_unions if u.name == type_ref.name)
                    if isinstance(type_ref, UnionRef)
                    else type_ref
                )
                variant = next(v for v in union.variants if not self._is_null(v))
                return self._example_value(variant, api, name, depth + 1)

        return Placeholder(
            name,
            quoted=not (
                isinstance(type_ref, PrimitiveType)
                and type_ref.type in ("integer", "number")
            ),
        )

    def _example_json(self, value: typing.Any) -> str:
        if isinstance(value, Placeholder):
            return f'"<{value.name}>"' if value.quoted else f"<{value.name}>"
        if isinstance(value, dict):
            items = (
                f"{json.dumps(key)}:{self._example_json(item)}"
                for key, item in value.items()
            )
            return f"{{{','.join(items)}}}"
        if isinstance(value, list):
            return f"[{','.join(self._example_json(item) for item in value)}]"
        return json.dumps(value)

    def _summary(self, description: str, fallback: str) -> str:
        sentences = re.split(
            r"(?<!e\.g\.)(?<!i\.e\.)(?<=\.)\s+", description.split("\n")[0]
        )
        kept = [s for s in sentences if "[" not in s and "]" not in s]
        return " ".join(kept).replace("**", "") or fallback

    def _flag_description(
        self,
        field: Field | Parameter,
        api: APIVersion,
        *,
        required: bool,
        json: bool,
    ) -> str:
        description = self._summary(field.description or field.name, field.name)
        if field.name == "organization_id":
            description = re.sub(r"\s*Required unless[^.]*\.", "", description)
            description = f"{description} Defaults to the active organization."
        if json:
            description = f"{description} JSON: {self._json_shape(field.type, api)}"
        return f"Required. {description}" if required else description

    def _json_shape(self, type_ref: TypeRef, api: APIVersion, depth: int = 0) -> str:
        if isinstance(type_ref, NullableType):
            inner = self._json_shape(type_ref.inner, api, depth)
            return (
                inner
                if depth == 0 or inner.endswith(NULLABLE)
                else f"{inner}{NULLABLE}"
            )

        if isinstance(type_ref, LiteralType):
            return json.dumps(type_ref.value)

        if isinstance(type_ref, PrimitiveType):
            return "any" if type_ref.type == "unknown" else type_ref.type

        if isinstance(type_ref, EnumRef):
            enum = next(e for e in api.enums if e.name == type_ref.name)
            values = [json.dumps(v.value) for v in enum.values]
            if len(values) > JSON_SHAPE_ENUM_VALUES:
                values = [*values[:JSON_SHAPE_ENUM_VALUES], "..."]
            return " | ".join(values)

        if isinstance(type_ref, ArrayType):
            items = self._json_shape(type_ref.items, api, depth)
            return f"array of {f'({items})' if ' | ' in items else items}"

        if isinstance(type_ref, MapType):
            value = self._json_shape(type_ref.value_type, api, depth + 1)
            return f'{{"<key>": {value}}}'

        if isinstance(type_ref, ModelRef):
            if depth >= JSON_SHAPE_DEPTH:
                return "{...}"
            model = next(m for m in api.input_models if m.name == type_ref.name)
            shown = [
                f"{json.dumps(f.name)}: {self._json_shape(f.type, api, depth + 1)}"
                for f in model.fields
                if f.required or isinstance(f.type, LiteralType)
            ]
            if len(shown) < len(model.fields):
                shown.append("...")
            return f"{{{', '.join(shown)}}}"

        if isinstance(type_ref, (UnionRef, UnionType)):
            union = (
                next(u for u in api.input_unions if u.name == type_ref.name)
                if isinstance(type_ref, UnionRef)
                else type_ref
            )
            shapes: list[str] = []
            nullable = False
            for variant in union.variants:
                if self._is_null(variant):
                    nullable = True
                    continue
                shape = self._json_shape(variant, api, depth)
                nullable = nullable or shape.endswith(NULLABLE)
                shape = shape.removesuffix(NULLABLE)
                if shape not in shapes:
                    shapes.append(shape)
            joined = " | ".join(shapes)
            return f"{joined}{NULLABLE}" if nullable and depth > 0 else joined

        return "any"

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
            fields_by_variant = [
                self._body_fields(variant, api) for variant in union.variants
            ]
            descriptions: dict[str, list[str]] = {}
            for field in (f for variant in fields_by_variant for f in variant):
                previous = fields.get(field.name)
                if field.description and not self._is_null(field.type):
                    summary = self._summary(field.description, "")
                    if summary and summary not in descriptions.setdefault(
                        field.name, []
                    ):
                        descriptions[field.name].append(summary)
                elif previous and previous.description:
                    field = field.model_copy(
                        update={"description": previous.description}
                    )
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

            return [
                field.model_copy(
                    update={
                        "required": all(
                            any(f.name == field.name and f.required for f in variant)
                            for variant in fields_by_variant
                        ),
                        "description": " ".join(descriptions[field.name])
                        if field.name in descriptions
                        else field.description,
                    }
                )
                for field in fields.values()
            ]

        raise ValueError(f"Unsupported request body: {body}")

    def _is_null(self, type_ref: TypeRef) -> bool:
        return isinstance(type_ref, LiteralType) and type_ref.value is None

    def _flag_expression(self, type_ref: TypeRef, name: str, api: APIVersion) -> str:
        quoted = json.dumps(name)

        if isinstance(type_ref, NullableType):
            expression = self._flag_expression(type_ref.inner, name, api)
            if expression == f"Flag.String({quoted})":
                return f"nullableStringFlag({quoted})"
            return expression

        if isinstance(type_ref, PrimitiveType):
            constructor = {
                "string": "String",
                "integer": "Int",
                "number": "Finite",
                "boolean": "Boolean",
            }.get(type_ref.type)
            if constructor:
                return f"Flag.{constructor}({quoted})"

        if isinstance(type_ref, EnumRef):
            enum = next(e for e in api.enums if e.name == type_ref.name)
            values = [v.value for v in enum.values]
            if all(isinstance(v, str) for v in values):
                return f"Flag.Literals({quoted}, {json.dumps(values)})"

        if isinstance(type_ref, LiteralType) and isinstance(type_ref.value, str):
            return f"Flag.Literals({quoted}, {json.dumps([type_ref.value])})"

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
                return f"Flag.Literals({quoted}, {json.dumps(values)})"

            if any(
                isinstance(v, PrimitiveType) and v.type == "string" for v in variants
            ) and all(
                (isinstance(v, PrimitiveType) and v.type == "string")
                or (isinstance(v, LiteralType) and isinstance(v.value, str))
                for v in variants
            ):
                constructor = (
                    "nullableStringFlag"
                    if len(variants) != len(type_ref.variants)
                    else "Flag.String"
                )
                return f"{constructor}({quoted})"

            expressions = {self._flag_expression(v, name, api) for v in variants}
            if len(expressions) == 1:
                return expressions.pop()

            if expressions == {
                f"Flag.String({quoted})",
                f"nullableStringFlag({quoted})",
            }:
                return f"nullableStringFlag({quoted})"

            array = next((v for v in variants if isinstance(v, ArrayType)), None)
            if array:
                item_expression = self._flag_expression(array.items, name, api)
                array_expression = self._flag_expression(array, name, api)
                if expressions <= {item_expression, array_expression}:
                    return array_expression

        return f"jsonFlag({quoted})"
