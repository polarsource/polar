# Outpost SDK scenario harness

## Run

Requires `uv`, `just`, Node 24+, `pnpm`, and either `redis-server` on PATH or
`E2E_REDIS_URL`. Install the SDK
dependencies once (the TypeScript SDK needs its own build dependencies):

```sh
cd sdk/typescript && just install
cd ../e2e
just install
just test
```

To use Redis exposed by a container on port 6379:

```sh
E2E_REDIS_URL=redis://127.0.0.1:6379/0 just test
```

The SDK CI workflow runs both languages against a Redis service container using
this environment variable.
