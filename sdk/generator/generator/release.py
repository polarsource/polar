import concurrent.futures
import re
import subprocess
import sys

import keepachangelog

from generator.docs_openapi import generate_docs_openapi
from generator.openapi import GENERATOR_DIR, ROOT, generate_openapi

LANGUAGES = ["python", "typescript"]
GENERATED_PATHS = ["docs/openapi", "sdk/python", "sdk/typescript", "sdk/CHANGELOG.md"]
PRERELEASE_LANGUAGES = ["typescript"]
PRERELEASE_GENERATED_PATHS = ["sdk/typescript"]
OPENAPI_DIRECTORY = GENERATOR_DIR / "openapi"
CHANGELOG_PATH = ROOT / "sdk" / "CHANGELOG.md"


def validate_version(version: str) -> bool:
    pattern = r"^\d+\.\d+\.\d+$"
    return bool(re.match(pattern, version))


def validate_prerelease_tag(tag: str) -> bool:
    return bool(re.match(r"^[a-z][a-z0-9]*$", tag)) and tag != "latest"


def next_prerelease_version(version: str, tag: str) -> str:
    result = subprocess.run(
        ["git", "ls-remote", "--tags", "origin", f"refs/tags/sdk/{version}-{tag}.*"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    pattern = re.compile(rf"refs/tags/sdk/{re.escape(version)}-{tag}\.(\d+)$")
    numbers = [
        int(match.group(1))
        for line in result.stdout.splitlines()
        if (match := pattern.search(line))
    ]
    return f"{version}-{tag}.{max(numbers, default=0) + 1}"


def regenerate_openapi() -> None:
    generate_openapi(OPENAPI_DIRECTORY)


def generate_sdk(language: str, version: str) -> None:
    openapi_files = list((GENERATOR_DIR / "openapi").glob("*.json"))
    cmd = [
        sys.executable,
        "-m",
        "cli",
        "generate",
        *openapi_files,
        str(GENERATOR_DIR.parent / language),
        "--language",
        language,
        "--version",
        version,
        "--clear",
    ]
    subprocess.run(cmd, cwd=GENERATOR_DIR, check=True)


def generate_all_sdks(version: str, languages: list[str]) -> None:
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = {
            executor.submit(generate_sdk, language, version): language
            for language in languages
        }
        for future in concurrent.futures.as_completed(futures):
            language = futures[future]
            try:
                future.result()
                print(f"Generated {language} SDK")
            except Exception as e:
                print(f"Error generating {language} SDK: {e}", file=sys.stderr)
                raise


def create_git_commit(version: str, paths: list[str]) -> None:
    for path in paths:
        subprocess.run(["git", "add", path], cwd=ROOT, check=True)
    subprocess.run(
        ["git", "commit", "-m", f"sdk[release]: {version}"],
        cwd=ROOT,
        check=True,
    )


def release_sdk(
    version: str,
    skip_openapi: bool = False,
    skip_commit: bool = False,
) -> None:
    if not validate_version(version):
        print(f"Error: Invalid version format: {version}", file=sys.stderr)
        print("Expected format: X.Y.Z", file=sys.stderr)
        sys.exit(1)

    print(f"Releasing SDK version: {version}")

    try:
        changelog = keepachangelog.to_dict(str(CHANGELOG_PATH), show_unreleased=True)
        if version in changelog:
            raise ValueError(f"Changelog already contains version {version}")
        if not any(
            entries
            for category, entries in changelog.get("unreleased", {}).items()
            if category != "metadata"
        ):
            raise ValueError("Add release notes to sdk/CHANGELOG.md under [Unreleased]")

        if not skip_openapi:
            print("Regenerating OpenAPI spec...")
            regenerate_openapi()

        generate_all_sdks(version, LANGUAGES)
        generate_docs_openapi(
            list(OPENAPI_DIRECTORY.glob("*.json")),
            sdk_version=version,
        )
        keepachangelog.release(str(CHANGELOG_PATH), version)

        if not skip_commit:
            print("Creating git commit...")
            create_git_commit(version, GENERATED_PATHS)

        print(f"\nSuccessfully prepared SDK v{version} for release")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def release_prerelease_sdk(
    version: str,
    tag: str,
    skip_openapi: bool = False,
    skip_commit: bool = False,
) -> None:
    if not validate_version(version):
        print(f"Error: Invalid version format: {version}", file=sys.stderr)
        print("Expected format: X.Y.Z", file=sys.stderr)
        sys.exit(1)
    if not validate_prerelease_tag(tag):
        print(f"Error: Invalid prerelease tag: {tag}", file=sys.stderr)
        print(
            "Expected a lowercase word other than 'latest', e.g. next", file=sys.stderr
        )
        sys.exit(1)

    try:
        prerelease_version = next_prerelease_version(version, tag)
        print(f"Releasing TypeScript SDK prerelease: {prerelease_version}")

        if not skip_openapi:
            print("Regenerating OpenAPI spec...")
            regenerate_openapi()

        generate_all_sdks(prerelease_version, PRERELEASE_LANGUAGES)

        if not skip_commit:
            print("Creating git commit...")
            create_git_commit(prerelease_version, PRERELEASE_GENERATED_PATHS)

        print(
            f"\nSuccessfully prepared SDK v{prerelease_version} "
            f"for release under the '{tag}' npm tag"
        )

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
