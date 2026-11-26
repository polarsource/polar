import dataclasses
import importlib
import json
import math
import pathlib
import re
import typing

from generator.ir import (
    APIIR,
    APIVersion,
    ArrayType,
    EnumRef,
    LiteralType,
    MapType,
    Method,
    ModelRef,
    NamedUnion,
    NullableType,
    Parameter,
    PrimitiveType,
    Service,
    TypeRef,
    UnionDiscriminator,
    UnionRef,
    UnionType,
)


class CodeSampleError(ValueError):
    pass


@dataclasses.dataclass(frozen=True)
class SampleParameter:
    parameter: Parameter
    value: typing.Any


@dataclasses.dataclass(frozen=True)
class OperationSample:
    api: APIVersion
    service_path: tuple[str, ...]
    method: Method
    path_parameters: tuple[SampleParameter, ...]
    query_parameters: tuple[SampleParameter, ...]
    body: typing.Any | None


type CodeSampleRenderer = typing.Callable[[OperationSample], str]


class CodeSampleLanguage(typing.Protocol):
    language_label: typing.Callable[[], str]
    render_code_sample: CodeSampleRenderer


class ExampleGenerator:
    def __init__(self, api: APIVersion) -> None:
        self.models = {model.name: model for model in api.input_models}
        self.enums = {enum.name: enum for enum in api.enums}
        self.unions = {union.name: union for union in api.input_unions}

    def generate(self, type_ref: TypeRef) -> typing.Any:
        return self._generate(type_ref, ())

    def _generate(self, type_ref: TypeRef, stack: tuple[str, ...]) -> typing.Any:
        if isinstance(type_ref, LiteralType):
            return type_ref.value
        if isinstance(type_ref, PrimitiveType):
            return self._primitive(type_ref)
        if isinstance(type_ref, NullableType):
            return self._generate(type_ref.inner, stack)
        if isinstance(type_ref, ArrayType):
            item_count = max(1, type_ref.min_items or 0)
            if type_ref.max_items is not None:
                item_count = min(item_count, type_ref.max_items)
            if type_ref.min_items is not None and item_count < type_ref.min_items:
                raise CodeSampleError("Array constraints cannot be satisfied")
            return [self._generate(type_ref.items, stack) for _ in range(item_count)]
        if isinstance(type_ref, MapType):
            return {"key": self._generate(type_ref.value_type, stack)}
        if isinstance(type_ref, EnumRef):
            enum = self.enums.get(type_ref.name)
            if enum is None or not enum.values:
                raise CodeSampleError(f"Enum {type_ref.name} has no values")
            return enum.values[0].value
        if isinstance(type_ref, ModelRef):
            return self._model(type_ref.name, stack)
        if isinstance(type_ref, UnionRef):
            union = self.unions.get(type_ref.name)
            if union is None:
                raise CodeSampleError(f"Input union {type_ref.name} was not found")
            return self._named_union(union, stack)
        if isinstance(type_ref, UnionType):
            return self._union(
                type_ref.variants,
                type_ref.composition_kind,
                type_ref.discriminator,
                stack,
            )
        raise CodeSampleError(f"Unsupported input type: {type_ref}")

    def _primitive(self, type_ref: PrimitiveType) -> typing.Any:
        if type_ref.type == "string":
            formats = {
                "color": "#000000",
                "date": "2026-01-01",
                "date-time": "2026-01-01T00:00:00Z",
                "duration": "P1D",
                "email": "customer@example.com",
                "ipvanyaddress": "192.0.2.1",
                "uri": "https://example.com",
                "url": "https://example.com",
                "uuid": "00000000-0000-4000-8000-000000000000",
                "uuid4": "00000000-0000-4000-8000-000000000000",
            }
            return self._string(type_ref, formats.get(type_ref.format or "", "string"))
        if type_ref.type == "integer":
            return self._number(type_ref, integer=True)
        if type_ref.type == "number":
            return self._number(type_ref, integer=False)
        if type_ref.type == "boolean":
            return True
        raise CodeSampleError("Cannot generate an example for an unknown schema")

    def _string(self, type_ref: PrimitiveType, fallback: str) -> str:
        candidates = [
            fallback,
            "string",
            "example",
            "example-slug",
            "rk_example",
            "sk_example",
            "A123",
            "1.0",
            "1",
            "0",
            "usd",
            "image/png",
        ]
        pattern = None
        if type_ref.pattern is not None:
            try:
                pattern = re.compile(type_ref.pattern)
            except re.error as error:
                raise CodeSampleError(
                    f"Unsupported string pattern: {type_ref.pattern}"
                ) from error
        for candidate in candidates:
            minimum = type_ref.min_length or 0
            value = candidate + "x" * max(0, minimum - len(candidate))
            if type_ref.max_length is not None and len(value) > type_ref.max_length:
                continue
            if pattern is None or pattern.search(value):
                return value
        raise CodeSampleError("String constraints cannot be satisfied")

    def _number(self, type_ref: PrimitiveType, *, integer: bool) -> int | float:
        lower = type_ref.minimum
        lower_exclusive = False
        if type_ref.exclusive_minimum is not None:
            lower = type_ref.exclusive_minimum
            lower_exclusive = True
        upper = type_ref.maximum
        upper_exclusive = False
        if type_ref.exclusive_maximum is not None:
            upper = type_ref.exclusive_maximum
            upper_exclusive = True

        if integer:
            candidate = 1 if lower is None else math.ceil(lower)
            if lower_exclusive and candidate <= typing.cast(float, lower):
                candidate += 1
            if upper is not None and (
                candidate > upper or (upper_exclusive and candidate >= upper)
            ):
                candidate = math.floor(upper)
                if upper_exclusive and candidate >= upper:
                    candidate -= 1
        else:
            candidate = 1.0
            if lower is not None and (
                candidate < lower or (lower_exclusive and candidate <= lower)
            ):
                candidate = lower + (1.0 if upper is None else (upper - lower) / 2)
            if upper is not None and (
                candidate > upper or (upper_exclusive and candidate >= upper)
            ):
                candidate = upper - (1.0 if lower is None else (upper - lower) / 2)

        if lower is not None and (
            candidate < lower or (lower_exclusive and candidate <= lower)
        ):
            raise CodeSampleError("Numeric constraints cannot be satisfied")
        if upper is not None and (
            candidate > upper or (upper_exclusive and candidate >= upper)
        ):
            raise CodeSampleError("Numeric constraints cannot be satisfied")
        return candidate

    def _model(self, name: str, stack: tuple[str, ...]) -> dict[str, typing.Any]:
        key = f"model:{name}"
        if key in stack:
            raise CodeSampleError(f"Cyclic input schema: {' -> '.join((*stack, key))}")
        model = self.models.get(name)
        if model is None:
            raise CodeSampleError(f"Input model {name} was not found")
        value: dict[str, typing.Any] = {}
        for field in model.fields:
            if field.read_only:
                continue
            if field.has_example:
                value[field.name] = field.example
            elif field.has_default:
                value[field.name] = field.default
            elif field.required:
                value[field.name] = self._generate(field.type, (*stack, key))
        return value

    def _named_union(self, union: NamedUnion, stack: tuple[str, ...]) -> typing.Any:
        key = f"union:{union.name}"
        if key in stack:
            raise CodeSampleError(f"Cyclic input schema: {' -> '.join((*stack, key))}")
        return self._union(
            union.variants,
            union.composition_kind,
            union.discriminator,
            (*stack, key),
        )

    def _union(
        self,
        variants: list[TypeRef],
        composition_kind: str | None,
        discriminator: UnionDiscriminator | None,
        stack: tuple[str, ...],
    ) -> typing.Any:
        if not variants:
            raise CodeSampleError("Cannot generate an example for an empty union")
        if composition_kind == "allOf":
            value: dict[str, typing.Any] = {}
            for variant in variants:
                generated = self._generate(variant, stack)
                if not isinstance(generated, dict):
                    raise CodeSampleError("allOf inputs must contain object schemas")
                value.update(generated)
            return value
        variant = next(
            (
                candidate
                for candidate in variants
                if not (isinstance(candidate, LiteralType) and candidate.value is None)
            ),
            variants[0],
        )
        value = self._generate(variant, stack)
        if discriminator is not None and isinstance(value, dict):
            discriminator_value = self._discriminator_value(discriminator, variant)
            if discriminator_value is not None:
                value[discriminator.property_name] = discriminator_value
        return value

    def _discriminator_value(
        self, discriminator: UnionDiscriminator, variant: TypeRef
    ) -> str | None:
        if not isinstance(variant, ModelRef):
            return None
        for value, model_name in sorted(discriminator.mapping.items()):
            if model_name == variant.name:
                return value
        return None


def generate_code_samples_overlay(
    api: APIVersion,
    sdk_version: str,
    languages: typing.Iterable[str],
) -> dict[str, typing.Any]:
    language_modules = _load_language_modules(languages)

    actions: list[dict[str, typing.Any]] = []
    examples = ExampleGenerator(api)
    methods = sorted(_iter_methods(api.services), key=lambda item: item[1].operation_id)
    for service_path, method in methods:
        sample = _build_operation_sample(api, service_path, method, examples)
        code_samples = []
        for language, language_module in language_modules:
            try:
                source = language_module.render_code_sample(sample)
            except CodeSampleError:
                raise
            except Exception as error:
                raise CodeSampleError(
                    f"Unable to render {language} sample for {method.operation_id}: {error}"
                ) from error
            code_samples.append(
                {"lang": language_module.language_label(), "source": source}
            )
        target = (
            f'$["paths"][{json.dumps(method.path)}]'
            f'["{method.http_method.value.lower()}"]'
        )
        actions.append({"target": target, "update": {"x-codeSamples": code_samples}})

    return {
        "overlay": "1.1.0",
        "info": {
            "title": f"Polar {api.version} SDK code samples",
            "version": sdk_version,
        },
        "actions": actions,
    }


def generate_code_samples_overlays(
    ir: APIIR,
    sdk_version: str,
    languages: typing.Iterable[str],
) -> dict[str, dict[str, typing.Any]]:
    if not ir.versions:
        raise CodeSampleError("The API specification contains no versions")
    overlays: dict[str, dict[str, typing.Any]] = {}
    for api in ir.versions:
        if api.version in overlays:
            raise CodeSampleError(f"Duplicate API version: {api.version}")
        overlays[api.version] = generate_code_samples_overlay(
            api, sdk_version, languages
        )
    return overlays


def write_code_samples_overlays(
    output: pathlib.Path | str,
    ir: APIIR,
    sdk_version: str,
    languages: typing.Iterable[str],
) -> None:
    output_path = pathlib.Path(output)
    overlays = generate_code_samples_overlays(ir, sdk_version, languages)
    for api_version in overlays:
        if pathlib.Path(api_version).name != api_version:
            raise CodeSampleError(f"Invalid API version: {api_version}")
    output_path.mkdir(parents=True, exist_ok=True)
    for overlay_path in output_path.glob("*.overlay.json"):
        overlay_path.unlink()
    for api_version, overlay in overlays.items():
        (output_path / f"{api_version}.overlay.json").write_text(
            json.dumps(overlay, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )


def _load_language_modules(
    languages: typing.Iterable[str],
) -> list[tuple[str, CodeSampleLanguage]]:
    language_modules = [
        (
            language,
            typing.cast(
                CodeSampleLanguage,
                importlib.import_module(f"{language}.code_samples"),
            ),
        )
        for language in languages
    ]
    if not language_modules:
        raise CodeSampleError("At least one language must be selected")
    return language_modules


def _build_operation_sample(
    api: APIVersion,
    service_path: tuple[str, ...],
    method: Method,
    examples: ExampleGenerator,
) -> OperationSample:
    path_parameters = tuple(
        SampleParameter(parameter, _parameter_value(parameter, examples))
        for parameter in method.path_params
    )
    query_parameters = tuple(
        SampleParameter(parameter, _parameter_value(parameter, examples))
        for parameter in method.query_params
        if parameter.required or parameter.has_example or parameter.has_default
    )
    body = None
    if method.body is not None:
        body = examples.generate(method.body)
    return OperationSample(
        api=api,
        service_path=service_path,
        method=method,
        path_parameters=path_parameters,
        query_parameters=query_parameters,
        body=body,
    )


def _parameter_value(parameter: Parameter, examples: ExampleGenerator) -> typing.Any:
    if parameter.has_example:
        return parameter.example
    if parameter.has_default:
        return parameter.default
    return examples.generate(parameter.type)


def _iter_methods(
    services: list[Service], path: tuple[str, ...] = ()
) -> typing.Iterator[tuple[tuple[str, ...], Method]]:
    for service in services:
        service_path = (*path, service.name)
        for method in service.methods:
            yield service_path, method
        yield from _iter_methods(service.services, service_path)
