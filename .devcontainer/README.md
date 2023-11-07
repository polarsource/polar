# Welcome to the Polar Devcontainer

# Setup and running

_This is a work in progress, as we improve on our automation to remove as many of these steps as possible._

## Running the web

The web can be configured from `clients/apps/web/.env`. The `$GITHUB_` variables will be automatically filled in if running on Codespaces.

Run the web in the terminal with `cd /workspace/clients && pnpm dev`

## Running the api

The api server is configured from `server/.env.devcontainer`. You might need to change the `POLAR_GITHUB_` variables for the server to boot.

Run the api in the terminal with `cd /workspace/server && poetry run task api`

## Running the storybook

Requires no configuration.

Run the storybook in the terminal with `cd /workspace/clients && pnpm storybook`

# Testing

## Testing the api

Run the server tests in the terminal with `cd /workspace/server && poetry run task test`