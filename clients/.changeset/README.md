# Changesets

Polar is using https://github.com/changesets/changesets to manage releases to NPM.

1. When you've made a change that's worthy of a changelog entry: Run `pnpm changesets` and follow the prompt. Commit and push the files (ideally in the same PR as your changes).
2. The [action](https://github.com/polarsource/polar/actions/workflows/changeset_version.yaml) will run and create/update the "Version Packages" Pull Request.
3. When we're ready to make a release, merge the currently open "Version Packages" PR! The packages will be built, pushed to NPM, and tagged on GitHub!
