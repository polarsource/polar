# Welcome to the Polar Devcontainer

# Setup and running

_This is a work in progress, as we improve on our automation to remove as many of these steps as possible._

## Running

To get started, run the start command in the terminal

```bash
./bin/start
```


## Required: Setup a GitHub App

If this is the first time you're setting up this Codespace, you'll need to setup a the development environment first.

The first step is to setup a GitHub App.

With the app running (`./bin/start`), go to the app running on port 3001 in the browser, and follow the instructions for how to setup a GitHub App.

In VSCode (locally or in the browser), go to the "Ports" tab and click on the 🌐 (globe) icon next to the `setup-github` app that's running on port 3001.

## Running the storybook

Requires no configuration.

Run the storybook in the terminal with `cd /workspace/clients && pnpm storybook`

# Testing

## Testing the api

Run the server tests in the terminal with `cd /workspace/server && poetry run task test`


### Internal Docs: How the devcontainer works

Note: This this devcontainer is built to work on GitHub Codespaces. Parts of it will work in local-vscode, but it will not work as well.

**Networking**

All incoming traffic is sent through a Caddy process listening on port 8080. It routes traffic to Next or to the Python API depending on the path. This is needed to make the API work with GitHubs authenticating proxy.

When developing, you should use the URL that's on the format `https://$NAME-8080.app.github.dev/login`.

**setup-github**

The setup-github app is a way to automatically create a GitHub App and populate the appropriate .env files with URLs and metadata from the Codespaces environment. It's running on port 3001.
