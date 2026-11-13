# Python demo

A Python app on a JSON billing config. It shows what a language without its own config
language gets: the catalog lives in `polar.config.json`, and `polar config generate`
turns its meters, benefits, products and events into names the code imports.

| File                | What it is                                                   |
| ------------------- | ------------------------------------------------------------ |
| `polar.config.json` | The catalog. The same one as `../demo-app/polar.config.ts`   |
| `polar_types.py`      | Generated from the config. Do not edit                       |
| `main.py`           | Checks a benefit, reads a meter balance and tracks one event |

## Try it

After changing `polar.config.json`, regenerate the names:

```bash
polar config generate
```

In CI, fail when someone forgot to:

```bash
polar config generate --check
```

A misspelled name is then an error before the code runs:

```bash
uv run --with ty ty check
```

Run it against the sandbox organization the config is applied to:

```bash
POLAR_ACCESS_TOKEN=polar_oat_... uv run main.py <external customer ID>
```
