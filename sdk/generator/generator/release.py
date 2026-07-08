import concurrent.futures
import pathlib
import re
import subprocess
import sys

GENERATOR_DIR = pathlib.Path(__file__).parent.parent
ROOT = GENERATOR_DIR.parent.parent
LANGUAGES = ["python", "typescript"]


def validate_version(version: str) -> bool:
    pattern = r"^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?$"
    return bool(re.match(pattern, version))


def regenerate_openapi() -> None:
    cmd = "uv run -m --directory ../../server scripts.generate_openapi | jq -r"
    result = subprocess.run(
        cmd,
        shell=True,
        cwd=GENERATOR_DIR,
        capture_output=True,
        text=True,
        check=True,
    )
    (GENERATOR_DIR / "openapi.json").write_text(result.stdout)


def update_version_single_language(language: str, version: str) -> None:
    print(f"Updating {language} template version...")
    subprocess.run(
        [sys.executable, "-m", f"{language}.version", version],
        cwd=GENERATOR_DIR,
        check=True,
    )


def update_language_versions(version: str) -> None:
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = {
            executor.submit(update_version_single_language, language, version): language
            for language in LANGUAGES
        }
        for future in concurrent.futures.as_completed(futures):
            language = futures[future]
            try:
                future.result()
            except Exception as e:
                print(
                    f"Error updating {language} template version: {e}", file=sys.stderr
                )
                raise


def generate_sdk(language: str) -> None:
    cmd = [
        sys.executable,
        "-m",
        "cli",
        "generate",
        str(GENERATOR_DIR / "openapi.json"),
        str(GENERATOR_DIR.parent / language),
        "--language",
        language,
        "--clear",
    ]
    subprocess.run(cmd, cwd=GENERATOR_DIR, check=True)


def generate_all_sdks() -> None:
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = {
            executor.submit(generate_sdk, language): language for language in LANGUAGES
        }
        for future in concurrent.futures.as_completed(futures):
            language = futures[future]
            try:
                future.result()
                print(f"Generated {language} SDK")
            except Exception as e:
                print(f"Error generating {language} SDK: {e}", file=sys.stderr)
                raise


def create_git_commit(version: str) -> None:
    subprocess.run(["git", "add", "."], cwd=ROOT, check=True)
    subprocess.run(
        ["git", "commit", "-m", f"polar: Update SDK version to {version}"],
        cwd=ROOT,
        check=True,
    )


def release_sdk(
    version: str,
    skip_openapi: bool = False,
    skip_commit: bool = False,
    dry_run: bool = False,
) -> None:
    if not validate_version(version):
        print(f"Error: Invalid version format: {version}", file=sys.stderr)
        print("Expected format: X.Y.Z or X.Y.Z-pre-release", file=sys.stderr)
        sys.exit(1)

    print(f"Releasing SDK version: {version}")

    if dry_run:
        print("[DRY RUN] Would perform:")
        if not skip_openapi:
            print("  - Regenerate OpenAPI spec")
        print("  - Update Python template version")
        print("  - Update TypeScript template version")
        print("  - Regenerate Python SDK")
        print("  - Regenerate TypeScript SDK")
        if not skip_commit:
            print("  - Create git commit")
        return

    try:
        if not skip_openapi:
            print("Regenerating OpenAPI spec...")
            regenerate_openapi()

        update_language_versions(version)
        generate_all_sdks()

        if not skip_commit:
            print("Creating git commit...")
            create_git_commit(version)

        print(f"\nSuccessfully prepared SDK v{version} for release")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
