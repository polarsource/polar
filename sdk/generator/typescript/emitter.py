import pathlib

from generator.casing import to_camel_case, to_pascal_case, to_snake_case
from generator.emitter import EmitterBase
from generator.ir import (
    ArrayType,
    EnumRef,
    ErrorResponse,
    MapType,
    ModelRef,
    NullableType,
    OpenAPIIR,
    Service,
    UnionRef,
    UnionType,
)
from typescript.types import (
    collect_enum_imports,
    collect_type_imports,
    collect_union_imports,
    convert_type_to_typescript,
)
from typescript.utils import format_default_value_ts, format_description

EMITTER_DIRECTORY = pathlib.Path(__file__).parent


def _collect_type_ref_names(type_ref: object | None, ir: OpenAPIIR) -> set[str]:
    """Collect all model names from a TypeRef."""

    if type_ref is None:
        return set()

    names: set[str] = set()

    if isinstance(type_ref, (ModelRef, UnionRef)):
        names.add(type_ref.name)
    elif isinstance(type_ref, NullableType):
        names.update(_collect_type_ref_names(type_ref.inner, ir))
    elif isinstance(type_ref, ArrayType):
        names.update(_collect_type_ref_names(type_ref.items, ir))
    elif isinstance(type_ref, MapType):
        names.update(_collect_type_ref_names(type_ref.value_type, ir))
        if type_ref.key_type is not None:
            names.update(_collect_type_ref_names(type_ref.key_type, ir))
    elif isinstance(type_ref, UnionType):
        for variant in type_ref.variants:
            names.update(_collect_type_ref_names(variant, ir))

    return names


def _collect_enum_names(type_ref: object | None, ir: OpenAPIIR) -> set[str]:
    """Collect all enum names from a TypeRef."""

    if type_ref is None:
        return set()

    enum_imports: set[str] = set()

    if isinstance(type_ref, EnumRef):
        enum_imports.add(type_ref.name)
    elif isinstance(type_ref, NullableType):
        enum_imports.update(_collect_enum_names(type_ref.inner, ir))
    elif isinstance(type_ref, ArrayType):
        enum_imports.update(_collect_enum_names(type_ref.items, ir))
    elif isinstance(type_ref, MapType):
        enum_imports.update(_collect_enum_names(type_ref.value_type, ir))
        if type_ref.key_type is not None:
            enum_imports.update(_collect_enum_names(type_ref.key_type, ir))
    elif isinstance(type_ref, UnionType):
        for variant in type_ref.variants:
            enum_imports.update(_collect_enum_names(variant, ir))
    elif isinstance(type_ref, UnionRef):
        for union in ir.input_unions + ir.output_unions:
            if union.name == type_ref.name:
                for variant in union.variants:
                    enum_imports.update(_collect_enum_names(variant, ir))
                break

    return enum_imports


class TypeScriptEmitter(EmitterBase):
    def __init__(self, ir: OpenAPIIR) -> None:
        super().__init__(ir, EMITTER_DIRECTORY / "template")

    def emit(self, root_directory: pathlib.Path | str) -> None:
        """Emit the TypeScript SDK files to the specified root directory."""
        root_directory = self.ensure_directory(root_directory)

        # Create src directory
        src_dir = root_directory / "src"
        self.ensure_directory(src_dir)

        # Create models directory
        models_dir = src_dir / "models"
        self.ensure_directory(models_dir)

        # Create services directory
        services_dir = src_dir / "services"
        self.ensure_directory(services_dir)

        # Emit root configuration files
        self.copy_file(self.templates_dir / ".gitignore", root_directory / ".gitignore")
        self.copy_file(
            self.templates_dir / "package.json", root_directory / "package.json"
        )
        self.copy_file(
            self.templates_dir / "pnpm-workspace.yaml",
            root_directory / "pnpm-workspace.yaml",
        )
        self.copy_file(
            self.templates_dir / "tsconfig.json", root_directory / "tsconfig.json"
        )
        self.copy_file(
            self.templates_dir / "tsdown.config.ts", root_directory / "tsdown.config.ts"
        )
        self.copy_file(self.templates_dir / "justfile", root_directory / "justfile")
        self.copy_file(self.templates_dir / "README.md", root_directory / "README.md")

        # Emit src files
        self.render_file(
            "src/index.ts",
            src_dir / "index.ts",
            self.get_context(),
        )
        self.render_file(
            "src/base.ts",
            src_dir / "base.ts",
            self.get_context(),
        )
        self.render_file(
            "src/client.ts",
            src_dir / "client.ts",
            self.get_context(),
        )

        # Collect all errors
        errors = self._collect_all_errors()
        error_type_imports, error_type_aliases = self._get_error_type_imports(errors)
        self.render_file(
            "src/errors.ts",
            src_dir / "errors.ts",
            {
                **self.get_context(),
                "errors": errors,
                "error_type_imports": error_type_imports,
                "error_type_aliases": error_type_aliases,
            },
        )

        # Emit models
        self._emit_models(src_dir)

        # Emit services
        for service in self.ir.services:
            self._emit_service(service, services_dir)

    def setup_environment(self) -> None:
        """Add TypeScript-specific filters to the Jinja2 environment."""
        super().setup_environment()
        self.env.filters["ts_type"] = lambda type_ref, ref_suffix="": (
            convert_type_to_typescript(type_ref, self.ir, ref_suffix)
        )
        self.env.filters["camel"] = to_camel_case
        self.env.filters["pascal"] = to_pascal_case
        self.env.filters["snake"] = to_snake_case
        self.env.filters["format_default"] = format_default_value_ts
        self.env.filters["format_description"] = format_description

    def run_post_actions(self, root_directory: pathlib.Path | str) -> None:
        """Run post-processing actions: pnpm install, lint, build."""
        super().run_post_actions(root_directory)
        self.run_command("just install", cwd=root_directory)
        self.run_command("just lint-fix", cwd=root_directory)
        self.run_command("just typecheck", cwd=root_directory)
        self.run_command("just build", cwd=root_directory)

    def _emit_models(self, src_dir: pathlib.Path) -> None:
        """Emit all model files (inputs.ts, outputs.ts, literals.ts)."""
        models_dir = src_dir / "models"

        # Emit literals.ts (enums only)
        self.render_file(
            "src/models/literals.ts",
            models_dir / "literals.ts",
            {
                **self.get_context(),
                "enums": self.ir.enums,
            },
        )

        self.render_file(
            "src/models/inputs.ts",
            models_dir / "inputs.ts",
            {
                **self.get_context(),
                "models": self.ir.input_models,
                "unions": self.ir.input_unions,
                "enum_imports": self._get_input_enum_imports(),
            },
        )

        # Emit outputs.ts (output models and output unions)
        self.render_file(
            "src/models/outputs.ts",
            models_dir / "outputs.ts",
            {
                **self.get_context(),
                "models": self.ir.output_models,
                "unions": self.ir.output_unions,
                "enum_imports": self._get_output_enum_imports(),
            },
        )

    def _emit_service(
        self, service: Service, output_path: pathlib.Path, depth: int = 0
    ) -> None:
        """Emit a single service file, recursively handling nested services."""

        # Collect imports for this service
        imports = self._get_service_imports(service)

        # For nested services, create subdirectory
        if service.services:
            sub_service_path = output_path / to_snake_case(service.name)
            self.ensure_directory(sub_service_path)

            # Emit sub-services first
            for sub_service in service.services:
                self._emit_service(sub_service, sub_service_path, depth + 1)

            # Emit the parent service file
            import_depth = depth + 2
            service_path = sub_service_path / "index.ts"
        else:
            import_depth = depth + 1
            service_path = output_path / f"{to_snake_case(service.name)}.ts"

        base_import = "../" * import_depth + "base"
        models_import = "../" * import_depth + "models"
        errors_import = "../" * import_depth + "errors"

        context = {
            **self.get_context(),
            "service": service,
            "imports": imports,
            "base_import": base_import,
            "models_import": models_import,
            "errors_import": errors_import,
        }

        self.render_file("src/services/service.ts", service_path, context)

    def _get_input_enum_imports(self) -> set[str]:
        """Collect all enum imports needed for input models."""
        enum_imports: set[str] = set()
        for model in self.ir.input_models:
            for field in model.fields:
                collect_enum_imports(field.type, enum_imports, self.ir)
        for union in self.ir.input_unions:
            for variant in union.variants:
                collect_enum_imports(variant, enum_imports, self.ir)
        return enum_imports

    def _get_output_enum_imports(self) -> set[str]:
        """Collect all enum imports needed for output models."""
        enum_imports: set[str] = set()
        for model in self.ir.output_models:
            for field in model.fields:
                collect_enum_imports(field.type, enum_imports, self.ir)
        for union in self.ir.output_unions:
            for variant in union.variants:
                collect_enum_imports(variant, enum_imports, self.ir)
        return enum_imports

    def _collect_all_errors(self) -> list[ErrorResponse]:
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

        for service in self.ir.services:
            _collect_error_names_from_service(service)

        return errors

    def _get_error_type_imports(
        self, errors: list[ErrorResponse]
    ) -> tuple[dict[str, str], dict[str, str]]:
        """Collect all type imports needed for error classes, handling name collisions.

        Returns a tuple of (type_imports, error_type_aliases) where:
        - type_imports: mapping of type names to their import aliases
        - error_type_aliases: mapping of error names to their resolved type strings
        """

        type_imports: dict[str, str] = {}  # original_name -> alias_in_import
        error_type_aliases: dict[str, str] = {}  # error_name -> resolved_type_string

        for error in errors:
            if error.type is not None:
                # Collect all referenced model/union names from the type
                names = collect_type_imports(error.type, self.ir)
                # Get the type as a string
                type_str = convert_type_to_typescript(error.type, self.ir)

                # Track which types need to be imported
                for name in names:
                    # If the type name conflicts with the error class name, create an alias
                    if name == error.name:
                        alias = f"{name}Model"
                        type_imports[name] = alias
                        # Replace the name in the type string with the alias
                        error_type_aliases[error.name] = type_str.replace(name, alias)
                    elif name not in type_imports:
                        type_imports[name] = name

                if error.name not in error_type_aliases:
                    error_type_aliases[error.name] = type_str

        return type_imports, error_type_aliases

    def _get_service_imports(self, service: Service) -> dict[str, list[str]]:
        """Collect imports for a single service."""

        imports: dict[str, set[str]] = {
            "inputs": set(),
            "outputs": set(),
            "literals": set(),
            "errors": set(),
            "services": set(),
        }

        for method in service.methods:
            # Collect input imports from body
            if method.body is not None:
                imports["inputs"].update(_collect_type_ref_names(method.body, self.ir))
                imports["inputs"].update(collect_union_imports(method.body, self.ir))
                imports["literals"].update(_collect_enum_names(method.body, self.ir))

            # Collect output imports from response
            if method.response is not None:
                imports["outputs"].update(
                    _collect_type_ref_names(method.response, self.ir)
                )
                imports["outputs"].update(
                    collect_union_imports(method.response, self.ir)
                )
                imports["literals"].update(
                    _collect_enum_names(method.response, self.ir)
                )

            # Collect type names and enum imports from path and query parameters
            for param in method.path_params + method.query_params:
                imports["literals"].update(_collect_enum_names(param.type, self.ir))
                # Also collect model/union names from parameters
                if isinstance(param.type, ModelRef):
                    imports["inputs"].add(param.type.name)
                elif isinstance(param.type, UnionRef):
                    imports["inputs"].add(param.type.name)
                    imports["inputs"].update(collect_union_imports(param.type, self.ir))

            # Collect imports from error responses
            for error in method.errors:
                imports["errors"].add(error.name)

        # Collect sub-service imports
        for sub_service in service.services:
            imports["services"].add(sub_service.name)

        # Convert sets to sorted lists for Jinja compatibility
        return {
            "inputs": sorted(imports["inputs"]),
            "outputs": sorted(imports["outputs"]),
            "literals": sorted(imports["literals"]),
            "errors": sorted(imports["errors"]),
            "services": sorted(imports["services"]),
        }
