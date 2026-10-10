# Agent Instructions

This document provides essential guidance for AI agents contributing to Outpost. Imagine this file as a new joiner to the team who needs to understand the coding standards, practices, and conventions used in this repository.

## General Guidelines

- Do not add comments to the code unless necessary. The code should be self-explanatory.
- Use meaningful variable and function names.
- Follow good practices and code conventions.
- Make sure that all the new code is maintainable and follows the SOLID principles.
- Do not modify unrelated code to the task or issue you are working on.

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

## Conventions

- In the library code (not tests), use absolute imports within the `outpost` package (e.g., `from outpost.storage import create_storage`).
- Use fully qualified imports for standard library (e.g., `import datetime`/`datetime.datetime.now`, `import abc`/`abc.ABC`).
- Use fully qualified import for typing (e.g., `import typing`/`typing.Any`).
- Tests structure should mirror the library structure. For example, if you have a module `outpost.storage`, the tests for it should be in `tests/storage/test_storage.py`.
