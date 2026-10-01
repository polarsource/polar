# Homebrew publishing

The CLI is distributed through `polarsource/homebrew-tap`:

```sh
brew install polarsource/tap/polar
brew upgrade polarsource/tap/polar
```

## Setup

Before releasing the first version with Homebrew support:

1. Create a public `polarsource/homebrew-tap` repository with an initial commit
   on its default branch.
2. Create a fine-grained GitHub token restricted to that repository with
   **Contents: read/write** and **Pull requests: read/write** permissions.
3. Add it as the `HOMEBREW_TAP_TOKEN` Actions secret in **polarsource/polar**.
4. Publish a new CLI version containing the Homebrew updater guard, using the
   existing Changesets and **Release CLI** workflow.
5. Review and merge the generated formula PR in the tap. The install command
   becomes available after that merge.

The monorepo's `GITHUB_TOKEN` cannot write to the separate tap. Do not bootstrap
the public tap with an older CLI binary that lacks the Homebrew updater guard.

## Releases

After **Release CLI** publishes the complete `@polar-sh/cli@<version>` release,
its Homebrew job calls `publish_homebrew_cli.yml`. The job validates that the
release is stable, downloads its checksums, generates `Formula/polar.rb`, and
opens a version-specific PR in the tap. macOS and Linux arm64/x64 binaries come
from **polarsource/polar**; no binaries are rebuilt and users do not need Bun.
Draft verification runs do not publish a formula. Invalid or missing checksums
and missing configuration fail publishing rather than creating a partial package.

After fixing a publishing failure, retry an existing release with:

```sh
gh workflow run publish_homebrew_cli.yml --repo polarsource/polar -f 'tag=@polar-sh/cli@<version>'
```

Review tap PRs before merging. Close obsolete version PRs instead of merging
them after a newer version. Re-running a tag updates its existing PR and opens
no PR if the formula already matches the tap's default branch.

The monorepo's Client checks cover the generator and updater tests. A separate
Homebrew check installs, tests, styles and audits a generated formula on macOS
and Linux using the published `@polar-sh/cli@2.0.1` release as a fixture.

To inspect a formula locally:

```sh
gh release download '@polar-sh/cli@<version>' --repo polarsource/polar --pattern checksums.txt --dir /tmp/polar-cli-release
bun scripts/homebrew.ts '@polar-sh/cli@<version>' /tmp/polar-cli-release/checksums.txt /tmp/polar-formula/polar.rb
```

## Updates

`polar update` resolves the executable symlink and checks the keg's Homebrew
receipt. It directs Homebrew users to `brew upgrade polarsource/tap/polar` before
checking GitHub/npm or replacing the binary, including when `--method` is
provided. Homebrew installations do not check or advertise GitHub updates,
since the tap may not yet contain that release. Standalone and npm installations
retain their existing update behavior.
