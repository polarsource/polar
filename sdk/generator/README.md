# Polar SDK Generator

This project is the internal code generator for the Polar SDK. It is not intended to be used by external users, but rather as a tool for generating the SDK code from the OpenAPI specification.

It's highly tailored to the needs of the Polar SDK and is not designed to be a general-purpose code generator.

## Structure

### IR Generation

To maximize consistency between different language SDKs, the generator first creates an Intermediate Representation (IR) of the API based on the OpenAPI specification. This IR is a language-agnostic representation of the API's structure and behavior, with services, methods and models already pre-processed and normalized.

> [!INFO]
> This idea is taken from [WorkOS `oagen` project](https://github.com/workos/oagen).

### SDK Emitter

The SDK emitter takes the IR and generates the actual SDK code in the target programming language. We provide helpers to copy files, render templates with [Jinja template](https://jinja.palletsprojects.com/en/stable/), but the actual code generation logic is implemented in the language-specific generator.

## Generators

### Python

The Python generator is located in the `sdk/generator/python` folder. It generates the Python SDK code from the IR. Post processing includes linting with Ruff and type checking with ty.

Generate the Python SDK by running the following command:

```bash
uv run -m cli generate openapi.json ../python --language python --clear
```

## Releases

Add user-facing changes to `sdk/CHANGELOG.md` under `## [Unreleased]`, grouped by
`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security`. Entries apply to
all SDKs; prefix language-specific changes with `Python:` or `TypeScript:`.

Run `just release X.Y.Z` from this directory.
The release command uses `keepachangelog` to move the pending entries into a dated
version section, update comparison links, and include the changelog in the release
commit. Missing or empty notes and duplicate versions are rejected before generation.

Keep the `sdk%2F` prefix in comparison links
so `keepachangelog` preserves the SDK tag namespace when updating them.

When the release commit reaches `main`, CI publishes both SDKs and uses
`keepachangelog show` on the tagged changelog for the GitHub release body.

To ship TypeScript changes without moving npm's `latest` tag, run
`just release-pre X.Y.Z next`. It regenerates only the TypeScript SDK as
`X.Y.Z-next.N`, numbering after the existing `sdk/X.Y.Z-next.*` tags on `origin`, and
leaves the Python SDK, docs and changelog untouched. CI publishes it to npm under the `next`
dist-tag, and skips PyPI, the GitHub release and the adapter/CLI update PR. Users install it
with `@polar-sh/sdk@next`; the next `just release X.Y.Z` ships everything as usual.
