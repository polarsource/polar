import abc
import pathlib
import re
import subprocess
import typing

from jinja2 import Environment, FileSystemLoader, Template

from generator.ir import APIIR, APIVersion

_LOOP_DIRECTORY_PATTERN = re.compile(r"^\[\[([\w\.]+)\]\]$")


class EmitterBase(abc.ABC):
    def __init__(self, ir: APIIR, version: str, templates_dir: pathlib.Path | str):
        self.ir = ir
        self.version = version
        self.templates_dir = pathlib.Path(templates_dir)
        self.env = Environment(
            loader=FileSystemLoader(self.templates_dir),
            trim_blocks=True,
            lstrip_blocks=True,
        )
        self.setup_environment()

    @abc.abstractmethod
    def emit(self, root_directory: pathlib.Path | str) -> None: ...

    @abc.abstractmethod
    def get_version_string(self, api: APIVersion) -> str: ...

    def setup_environment(self) -> None:
        """Setup the Jinja2 environment with default context and filters.

        Override this method in subclasses to add custom filters, globals, or extensions.
        """
        pass

    def run_post_actions(self, root_directory: pathlib.Path | str) -> None:
        """Run any post-processing actions after emitting files.

        Override this method in subclasses to perform actions like formatting or linting.
        """
        pass

    def get_context(self) -> dict[str, typing.Any]:
        """Get the context dictionary for template rendering.

        Override this method in subclasses to add custom context variables.
        """
        return {"ir": self.ir, "version": self.version}

    def get_version_context(self, api: APIVersion) -> dict[str, typing.Any]:
        """Get the context dictionary for template rendering for a specific API version.

        Override this method in subclasses to add custom context variables for a specific version.
        """
        return {"ir": self.ir, "api": api, "version": self.get_version_string(api)}

    def copy_file(
        self, source: pathlib.Path | str, destination: pathlib.Path | str
    ) -> None:
        """Copy a file from source to destination."""
        source_path = pathlib.Path(source)
        destination_path = pathlib.Path(destination)
        self.ensure_directory(destination_path.parent)
        destination_path.write_bytes(source_path.read_bytes())

    def render_file(
        self,
        source: pathlib.Path | str,
        destination: pathlib.Path | str,
        context: dict[str, typing.Any],
    ) -> None:
        """Render a single template file with the context."""
        template = self.env.get_template(str(source))
        content = template.render(**context)
        self._write_file(destination, content)

    def ensure_directory(self, path: pathlib.Path | str) -> pathlib.Path:
        """Create directory and all parent directories if they don't exist."""
        path = pathlib.Path(path)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def run_command(self, command: str, cwd: pathlib.Path | str | None = None) -> None:
        """Run a shell command in the specified working directory."""
        cwd_path = pathlib.Path(cwd) if cwd else None
        subprocess.run(command, shell=True, check=True, cwd=cwd_path)

    def _write_file(
        self, path: pathlib.Path | str, content: str, *, overwrite: bool = True
    ) -> pathlib.Path:
        """Write content to a file, creating parent directories as needed."""
        path = pathlib.Path(path)
        self.ensure_directory(path.parent)
        if not overwrite and path.exists():
            return path
        path.write_text(content, encoding="utf-8")
        return path

    def _load_template(self, template_name: str) -> Template:
        """Load a Jinja2 template from the templates directory."""
        return self.env.get_template(template_name)

    def _render_template(
        self,
        template: Template | str,
        **context,
    ) -> str:
        """Render a Jinja2 template with the given context."""
        if isinstance(template, str):
            template = self._load_template(template)
        return template.render(**context)
