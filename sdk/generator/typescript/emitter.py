import pathlib

from generator.casing import to_camel_case, to_pascal_case, to_snake_case
from generator.emitter import EmitterBase, Prerelease
from generator.ir import (
    APIIR,
    APIVersion,
    ErrorResponse,
    ModelRef,
    Service,
    UnionRef,
)
from typescript.types import (
    collect_enum_names,
    collect_type_imports,
    collect_union_imports,
    convert_type_to_typescript,
)
from typescript.utils import format_default_value_ts, format_description

EMITTER_DIRECTORY = pathlib.Path(__file__).parent


class TypeScriptEmitter(EmitterBase):
    def __init__(
        self, ir: APIIR, version: str, *, prerelease: Prerelease | None = None
    ) -> None:
        super().__init__(
            ir, version, EMITTER_DIRECTORY / "template", prerelease=prerelease
        )

    def emit(self, root_directory: pathlib.Path | str) -> None:
        """Emit the TypeScript SDK files to the specified root directory."""
        root_directory = self.ensure_directory(root_directory)
        src_dir = root_directory / "src"

        # Emit root configuration files
        self.copy_file(self.templates_dir / ".gitignore", root_directory / ".gitignore")
        self.copy_file(
            self.templates_dir / "pnpm-workspace.yaml",
            root_directory / "pnpm-workspace.yaml",
        )
        self.copy_file(
            self.templates_dir / "tsconfig.json", root_directory / "tsconfig.json"
        )

        self.copy_file(
            self.templates_dir / "oxfmt.config.ts", root_directory / "oxfmt.config.ts"
        )
        self.copy_file(self.templates_dir / "justfile", root_directory / "justfile")
        self.copy_file(self.templates_dir / "LICENSE", root_directory / "LICENSE")

        self.render_file(
            "README.md",
            root_directory / "README.md",
            self.get_context(),
        )
        self.render_file(
            "package.json",
            root_directory / "package.json",
            self.get_context(),
        )
        self.render_file(
            "tsdown.config.ts",
            root_directory / "tsdown.config.ts",
            self.get_context(),
        )
        self.render_file(
            "src/base.ts",
            src_dir / "base.ts",
            self.get_context(),
        )
        self.render_file(
            "src/base.test.ts",
            src_dir / "base.test.ts",
            self.get_context(),
        )
        self.render_file(
            "src/index.ts",
            src_dir / "index.ts",
            self.get_context(),
        )

        for api in self.ir.versions:
            version_dir = src_dir / self.get_version_string(api)
            self.render_file(
                "src/version/index.ts",
                version_dir / "index.ts",
                self.get_version_context(api),
            )
            self.render_file(
                "src/version/client.ts",
                version_dir / "client.ts",
                self.get_version_context(api),
            )

            errors = self._collect_all_errors(api)
            self.render_file(
                "src/version/errors.ts",
                version_dir / "errors.ts",
                {
                    **self.get_version_context(api),
                    "errors": errors,
                    "error_imports": self._get_error_type_imports(errors, api),
                },
            )

            # Emit models
            self._emit_models(version_dir, api)

            # Emit services
            for service in api.services:
                self._emit_service(service, api, version_dir / "services")

    def get_version_string(self, api: APIVersion) -> str:
        """Return the version string for a given API version."""
        return api.version

    def format_version(self) -> str:
        """Return the SDK version in semver notation (e.g. '1.2.3-alpha.1')."""
        if self.prerelease is None:
            return self.version
        return f"{self.version}-{self.prerelease}"

    def setup_environment(self) -> None:
        """Add TypeScript-specific filters to the Jinja2 environment."""
        super().setup_environment()
        self.env.filters["ts_type"] = lambda type_ref, ref_suffix="": (
            convert_type_to_typescript(type_ref, ref_suffix)
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
        self.run_command("just test", cwd=root_directory)

    def _emit_models(self, version_dir: pathlib.Path, api: APIVersion) -> None:
        """Emit models.ts file directly in the version directory."""
        self.render_file(
            "src/version/models.ts",
            version_dir / "models.ts",
            {
                **self.get_version_context(api),
                "enums": api.enums,
                "models": api.all_models,
                "unions": api.all_unions,
            },
        )

    def _emit_service(
        self,
        service: Service,
        api: APIVersion,
        output_path: pathlib.Path,
        depth: int = 0,
    ) -> None:
        """Emit a single service file, recursively handling nested services."""

        # Collect imports for this service
        imports = self._get_service_imports(service, api)

        # For nested services, create subdirectory
        if service.services:
            sub_service_path = output_path / to_snake_case(service.name)
            self.ensure_directory(sub_service_path)

            # Emit sub-services first
            for sub_service in service.services:
                self._emit_service(sub_service, api, sub_service_path, depth + 1)

            # Emit the parent service file
            import_depth = depth + 2
            service_path = sub_service_path / "index.ts"
        else:
            import_depth = depth + 1
            service_path = output_path / f"{to_snake_case(service.name)}.ts"

        base_import = "../" + "../" * import_depth + "base"
        models_import = "../" * import_depth + "models"
        errors_import = "../" * import_depth + "errors"

        context = {
            **self.get_version_context(api),
            "service": service,
            "imports": imports,
            "base_import": base_import,
            "models_import": models_import,
            "errors_import": errors_import,
        }

        self.render_file("src/version/services/service.ts", service_path, context)

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

    def _get_error_type_imports(
        self, errors: list[ErrorResponse], api: APIVersion
    ) -> list[str]:
        """Collect imports for the errors module."""
        imports: set[str] = set()

        for error in errors:
            if error.type is not None:
                for name in collect_type_imports(error.type, api):
                    imports.add(name)

        return sorted(imports)

    def _get_service_imports(
        self, service: Service, api: APIVersion
    ) -> dict[str, list[str]]:
        """Collect imports for a single service."""

        imports: dict[str, set[str]] = {
            "models": set(),
            "errors": set(),
            "services": set(),
        }

        for method in service.methods:
            # Collect all type imports from body
            if method.body is not None:
                imports["models"].update(collect_type_imports(method.body, api))
                imports["models"].update(collect_union_imports(method.body, api))
                imports["models"].update(collect_enum_names(method.body, api))

            # Collect all type imports from response
            if method.response is not None:
                imports["models"].update(collect_type_imports(method.response, api))
                imports["models"].update(collect_union_imports(method.response, api))
                imports["models"].update(collect_enum_names(method.response, api))

            # Collect from path and query parameters
            for param in method.path_params + method.query_params:
                imports["models"].update(collect_enum_names(param.type, api))
                # Also collect model/union names from parameters
                if isinstance(param.type, ModelRef):
                    imports["models"].add(param.type.name)
                elif isinstance(param.type, UnionRef):
                    imports["models"].add(param.type.name)
                    imports["models"].update(collect_union_imports(param.type, api))

            # Collect imports from error responses
            for error in method.errors:
                imports["errors"].add(error.name)

            # Collect imports for pagination item schemas
            if method.pagination is not None:
                imports["models"].update(
                    collect_type_imports(method.pagination.item_schema, api)
                )
                imports["models"].update(
                    collect_union_imports(method.pagination.item_schema, api)
                )
                imports["models"].update(
                    collect_enum_names(method.pagination.item_schema, api)
                )

        # Collect sub-service imports
        for sub_service in service.services:
            imports["services"].add(sub_service.name)

        # Convert sets to sorted lists for Jinja compatibility
        return {
            "models": sorted(imports["models"]),
            "errors": sorted(imports["errors"]),
            "services": sorted(imports["services"]),
        }
