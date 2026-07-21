import pathlib

from generator.casing import to_snake_case
from generator.emitter import EmitterBase, Prerelease
from generator.ir import (
    APIIR,
    APIVersion,
    ArrayType,
    ErrorResponse,
    MapType,
    ModelRef,
    NullableType,
    Service,
    TypeRef,
    UnionRef,
    UnionType,
)
from python.naming import operation_name, paginator_name, service_name
from python.types import (
    collect_enum_imports,
    convert_type_to_annotation,
    wrap_nullable_type,
)
from python.utils import format_default_value, format_default_value_dataclass
from typescript.types import collect_enum_names

EMITTER_DIRECTORY = pathlib.Path(__file__).parent


def _collect_type_ref_names(
    type_ref: TypeRef | None, api: APIVersion, explode_union_ref: bool = False
) -> set[str]:
    """Collect all model names from a TypeRef."""
    if type_ref is None:
        return set()

    names: set[str] = set()

    if isinstance(type_ref, ModelRef):
        names.add(type_ref.name)
    elif isinstance(type_ref, UnionRef):
        if not explode_union_ref:
            names.add(type_ref.name)
        else:
            for union in api.input_unions + api.output_unions:
                if union.name == type_ref.name:
                    for variant in union.variants:
                        if isinstance(variant, ModelRef):
                            names.add(variant.name)
    elif isinstance(type_ref, UnionType):
        for variant in type_ref.variants:
            names.update(_collect_type_ref_names(variant, api))
    elif isinstance(type_ref, (ArrayType, NullableType, MapType)):
        # Recursively collect from inner types
        if isinstance(type_ref, ArrayType):
            names.update(_collect_type_ref_names(type_ref.items, api))
        elif isinstance(type_ref, NullableType):
            names.update(_collect_type_ref_names(type_ref.inner, api))
        elif isinstance(type_ref, MapType):
            names.update(_collect_type_ref_names(type_ref.value_type, api))
            if type_ref.key_type is not None:
                names.update(_collect_type_ref_names(type_ref.key_type, api))

    return names


class PythonEmitter(EmitterBase):
    def __init__(
        self, ir: APIIR, version: str, *, prerelease: Prerelease | None = None
    ) -> None:
        super().__init__(
            ir, version, EMITTER_DIRECTORY / "template", prerelease=prerelease
        )

    def format_version(self) -> str:
        """Return the SDK version in PEP 440 notation (e.g. '1.2.3a1', '1.2.3b2', '1.2.3rc3')."""
        if self.prerelease is None:
            return self.version
        _pep440: dict[str, str] = {"alpha": "a", "beta": "b", "rc": "rc"}
        return f"{self.version}{_pep440[self.prerelease.label]}{self.prerelease.number}"

    def emit(self, root_directory: pathlib.Path | str) -> None:
        """Emit the Python SDK files to the specified root directory."""
        root_directory = self.ensure_directory(root_directory)

        for file in {
            (".zed", "settings.json"),
            ("polar", "__init__.py"),
            ("polar", "base.py"),
            ("polar", "webhooks.py"),
            ("tests", "__init__.py"),
            ("tests", "test_base.py"),
            ("tests", "test_webhooks.py"),
            (".python-version",),
            ("justfile",),
            ("LICENSE",),
            ("pyproject.toml",),
            ("README.md",),
        }:
            self.render_file(
                "/".join(file),
                root_directory.joinpath(*file),
                self.get_context(),
            )

        for api in self.ir.versions:
            version_dir = root_directory / "polar" / self.get_version_string(api)
            self.render_file(
                "polar/version/__init__.py",
                version_dir / "__init__.py",
                {
                    **self.get_version_context(api),
                },
            )
            self.render_file(
                "polar/version/client.py",
                version_dir / "client.py",
                {
                    **self.get_version_context(api),
                },
            )
            self.render_file(
                "polar/version/literals.py",
                version_dir / "literals.py",
                {
                    **self.get_version_context(api),
                },
            )
            self.render_file(
                "polar/version/inputs.py",
                version_dir / "inputs.py",
                {
                    **self.get_version_context(api),
                    "input_enum_imports": self._get_input_enum_imports(api),
                },
            )

            self.render_file(
                "polar/version/outputs.py",
                version_dir / "outputs.py",
                {
                    **self.get_version_context(api),
                    "output_enum_imports": self._get_output_enum_imports(api),
                },
            )
            self.render_file(
                "polar/version/webhooks.py",
                version_dir / "webhooks.py",
                {
                    **self.get_version_context(api),
                    "imports": self._get_webhook_imports(api),
                    "enum_imports": self._get_webhook_enum_imports(api),
                },
            )
            errors = self._collect_all_errors(api)
            self.render_file(
                "polar/version/errors.py",
                version_dir / "errors.py",
                {
                    **self.get_version_context(api),
                    "errors": errors,
                    "imports": self._get_errors_imports(errors, api),
                },
            )

            services_dir = version_dir / "services"
            self._write_file(services_dir / "__init__.py", "")
            for service in api.services:
                self._emit_service(service, api, services_dir)

    def get_version_string(self, api: APIVersion) -> str:
        """Return the version string for a given APIVersion."""
        return f"v{to_snake_case(api.version).replace('.', '_')}"

    def run_post_actions(self, root_directory: pathlib.Path | str) -> None:
        super().run_post_actions(root_directory)
        self.run_command("just install", cwd=root_directory)
        self.run_command("just lint", cwd=root_directory)
        self.run_command("just test", cwd=root_directory)

    def setup_environment(self) -> None:
        """Add Python-specific filters to the Jinja2 environment."""
        super().setup_environment()
        self.env.filters["type_annotation"] = convert_type_to_annotation
        self.env.filters["wrap_nullable"] = wrap_nullable_type
        self.env.filters["snake"] = to_snake_case
        self.env.filters["operation_name"] = operation_name
        self.env.filters["paginator_name"] = paginator_name
        self.env.filters["service_name"] = service_name
        self.env.filters["format_default"] = format_default_value
        self.env.filters["format_default_dataclass"] = format_default_value_dataclass

    def _emit_service(
        self, service: Service, api: APIVersion, output_path: pathlib.Path
    ) -> None:
        """Emit a single service file, recursively going to sub-services."""
        if service.services:
            sub_service_path = output_path / service_name(service.name)
            for sub_service in service.services:
                self._emit_service(sub_service, api, sub_service_path)
            service_path = sub_service_path / "__init__.py"
        else:
            service_path = output_path / f"{service_name(service.name)}.py"

        self.render_file(
            "polar/version/services/service.py",
            service_path,
            {
                **self.get_version_context(api),
                "service": service,
                "imports": self._get_service_imports(service, api),
            },
        )

    def _get_input_enum_imports(self, api: APIVersion) -> set[str]:
        enum_imports: set[str] = set()
        for model in api.input_models:
            for field in model.fields:
                collect_enum_imports(field.type, enum_imports, api)
        return enum_imports

    def _get_output_enum_imports(self, api: APIVersion) -> set[str]:
        enum_imports: set[str] = set()
        for model in api.output_models:
            for field in model.fields:
                collect_enum_imports(field.type, enum_imports, api)
        return enum_imports

    def _get_webhook_imports(self, api: APIVersion) -> list[str]:
        imports: set[str] = set()
        for model in api.webhooks:
            for field in model.fields:
                imports.update(_collect_type_ref_names(field.type, api))
        return sorted(imports)

    def _get_webhook_enum_imports(self, api: APIVersion) -> list[str]:
        enum_imports: set[str] = set()
        for model in api.webhooks:
            for field in model.fields:
                collect_enum_imports(field.type, enum_imports, api)
        return sorted(enum_imports)

    def _collect_all_errors(self, api: APIVersion) -> list[ErrorResponse]:
        """Collect all unique error responses from all services and methods."""
        errors: list[ErrorResponse] = []
        error_names: set[str] = set()

        def _collect_error_names_from_service(service: Service) -> None:
            for method in service.methods:
                for error in method.errors:
                    if error.name not in error_names:
                        errors.append(error)
                        error_names.add(error.name)

            # Recursively collect from sub-services
            for sub_service in service.services:
                _collect_error_names_from_service(sub_service)

        for service in api.services:
            _collect_error_names_from_service(service)

        return errors

    def _get_errors_imports(
        self, errors: list[ErrorResponse], api: APIVersion
    ) -> list[str]:
        """Collect imports for the errors module."""
        imports: set[str] = set()
        for error in errors:
            if error.type is not None:
                imports |= _collect_type_ref_names(error.type, api)
        return sorted(imports)

    def _get_service_imports(
        self, service: Service, api: APIVersion
    ) -> dict[str, list[str]]:
        """Collect imports for a single service."""

        imports: dict[str, set[str]] = {
            "input": set(),
            "output": set(),
            "enum": set(),
            "errors": set(),
        }

        for method in service.methods:
            # Collect input imports from body
            if method.body is not None:
                imports["input"].update(
                    _collect_type_ref_names(method.body, api, explode_union_ref=True)
                )
                imports["enum"].update(collect_enum_names(method.body, api))

            # Collect output imports from response
            if method.response is not None:
                imports["output"].update(_collect_type_ref_names(method.response, api))
                imports["enum"].update(collect_enum_names(method.response, api))

            if method.pagination is not None:
                imports["output"].update(
                    _collect_type_ref_names(method.pagination.item_schema, api)
                )
                imports["enum"].update(
                    collect_enum_names(method.pagination.item_schema, api)
                )

            # Collect type names and enum imports from path and query parameters
            for param in method.path_params + method.query_params:
                imports["enum"].update(collect_enum_names(param.type, api))
                # Also collect model/union names from parameters
                if isinstance(param.type, (ModelRef, UnionRef)):
                    imports["input"].add(param.type.name)

            # Collect imports from error responses
            for error in method.errors:
                imports["errors"].add(error.name)

        # Convert sets to sorted lists for Jinja compatibility
        return {
            "input": sorted(imports["input"]),
            "output": sorted(imports["output"]),
            "enum": sorted(imports["enum"]),
            "errors": sorted(imports["errors"]),
        }
