import concurrent.futures
import pathlib
import re
import subprocess
import sys

from generator.emitter import Prerelease

GENERATOR_DIR = pathlib.Path(__file__).parent.parent
ROOT = GENERATOR_DIR.parent.parent
LANGUAGES = ["python", "typescript"]
GENERATED_SDK_PATHS = ["sdk/python", "sdk/typescript"]
CODE_SAMPLES_PATH = ROOT / "sdk" / "code-samples"


def validate_version(version: str) -> bool:
    pattern = r"^\d+\.\d+\.\d+$"
    return bool(re.match(pattern, version))


def regenerate_openapi() -> None:
    cmd = "set -o pipefail && uv run -m --directory ../../server scripts.generate_openapi | jq -r"
    result = subprocess.run(
        cmd,
        shell=True,
        executable="/bin/bash",
        cwd=GENERATOR_DIR,
        capture_output=True,
        text=True,
        check=True,
    )
    (GENERATOR_DIR / "openapi.json").write_text(result.stdout)


def generate_sdk(
    language: str, version: str, prerelease: Prerelease | None = None
) -> None:
    cmd = [
        sys.executable,
        "-m",
        "cli",
        "generate",
        str(GENERATOR_DIR / "openapi.json"),
        str(GENERATOR_DIR.parent / language),
        "--language",
        language,
        "--version",
        version,
        "--clear",
    ]
    if prerelease is not None:
        cmd += ["--prerelease", str(prerelease)]
    subprocess.run(cmd, cwd=GENERATOR_DIR, check=True)


def generate_all_sdks(version: str, prerelease: Prerelease | None = None) -> None:
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = {
            executor.submit(generate_sdk, language, version, prerelease): language
            for language in LANGUAGES
        }
        for future in concurrent.futures.as_completed(futures):
            language = futures[future]
            try:
                future.result()
                print(f"Generated {language} SDK")
            except Exception as e:
                print(f"Error generating {language} SDK: {e}", file=sys.stderr)
                raise


def generate_code_samples(version: str, prerelease: Prerelease | None = None) -> None:
    release_label = f"{version}-{prerelease}" if prerelease else version
    subprocess.run(
        [
            sys.executable,
            "-m",
            "cli",
            "code-samples",
            str(GENERATOR_DIR / "openapi.json"),
            str(CODE_SAMPLES_PATH),
            "--language",
            "python",
            "--language",
            "typescript",
            "--version",
            release_label,
        ],
        cwd=GENERATOR_DIR,
        check=True,
    )


def create_git_commit(version: str, prerelease: Prerelease | None = None) -> None:
    release_label = f"{version}-{prerelease}" if prerelease else version
    for path in GENERATED_SDK_PATHS:
        subprocess.run(["git", "add", path], cwd=ROOT, check=True)
    subprocess.run(
        ["git", "commit", "-m", f"sdk[release]: {release_label}"],
        cwd=ROOT,
        check=True,
    )


def release_sdk(
    version: str,
    prerelease: Prerelease | None = None,
    skip_openapi: bool = False,
    skip_commit: bool = False,
    dry_run: bool = False,
) -> None:
    if not validate_version(version):
        print(f"Error: Invalid version format: {version}", file=sys.stderr)
        print("Expected format: X.Y.Z", file=sys.stderr)
        sys.exit(1)

    release_label = f"{version}-{prerelease}" if prerelease else version
    print(f"Releasing SDK version: {release_label}")

    if dry_run:
        print("[DRY RUN] Would perform:")
        if not skip_openapi:
            print("  - Regenerate OpenAPI spec")
        print("  - Regenerate Python SDK")
        print("  - Regenerate TypeScript SDK")
        print("  - Regenerate SDK code samples overlay")
        if not skip_commit:
            print("  - Create git commit")
        return

    try:
        if not skip_openapi:
            print("Regenerating OpenAPI spec...")
            regenerate_openapi()

        generate_all_sdks(version, prerelease)
        generate_code_samples(version, prerelease)

        if not skip_commit:
            print("Creating git commit...")
            create_git_commit(version, prerelease)

        print(f"\nSuccessfully prepared SDK v{release_label} for release")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
