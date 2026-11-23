# Agent Instructions

This document provides essential guidance for AI agents contributing to the Polar SDK generator. Imagine this file as a new joiner to the team who needs to understand the coding standards, practices, and conventions used in this repository.

## General Guidelines

- Do not add comments to the code unless necessary. The code should be self-explanatory.
- Use meaningful variable and function names.
- Follow good practices and code conventions.
- Make sure that all the new code is maintainable and follows the SOLID principles.
- Do not modify unrelated code to the task or issue you are working on.
- The library is not yet stable and not widely used in production, so breaking changes are encouraged if they are justified by a significant improvement in design, security, or maintainability. Always favor the best design and security practices, even if it means introducing breaking changes.

### Linting and testing

The project needs to be linted and type-checked. To do so, run:

```bash
just lint
```

Tests are located in the `tests/` directory. It uses `pytest` for testing. To run the tests, use:

```bash
just test
```

Always privilege the `just` commands as described above to check your work. **Don't run manual linting or testing commands without being asked to do so.**

### Running Python commands

The project uses `uv` for environment and dependency management. To run Python commands, use:

```bash
uv run python <your_command_here>
```

## Generated SDKs

`sdk/python/` and `sdk/typescript/` are output only. `just release` runs the generator with `--clear`, which deletes each output directory and rebuilds it, so a change made there is lost on the next release.

To change SDK code, including hand-written modules like `metering/` and `outpost/`, and their tests:

1. Edit the file under `python/template/` or `typescript/template/`.
2. A new file is only emitted if the emitter picks it up, and the two languages differ:
   - **TypeScript:** every `.ts` file in `template/src/metering/` and `template/src/outpost/` is globbed. Any other new file needs a `render_file` call in `typescript/emitter.py`.
   - **Python:** nothing is globbed. Add every new file, including modules and tests under `metering/` and `outpost/`, to the file set in `PythonEmitter.emit` in `python/emitter.py`.
3. Run `just openapi` to export the specs into `openapi/`. That directory is gitignored, so it's empty in a fresh checkout. The specs come from the current server, so the output can also pick up API changes not yet released.
4. Regenerate with `uv run -m cli generate openapi/*.json ../<language> --language <language> --version <current version> --clear`. Don't use `just generate`: it omits `--version`, which stamps the SDK as `0.0.0`.
5. Commit the template and the generated output together.

To check that a template change took effect, regenerate and confirm `git status` doesn't show the output reverting your edit.

## Conventions

- Use absolute imports within the `generator` package (e.g., `from generator.emitter import EmitterBase`).
- Use fully qualified imports for standard library (e.g., `import datetime`/`datetime.datetime.now`, `import abc`/`abc.ABC`).
- Use fully qualified import for typing (e.g., `import typing`/`typing.Any`).
- When implementing classes, put private methods (prefixed with `_`) always **after** the public ones.
