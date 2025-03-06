# Backoffice

This module contains the code of our web-based backoffice.

## Architecture

It consists of a [FastAPI app](__init__.py) that's mounted on our main API.

Endpoints render HTML pages using [Tagflow](https://github.com/lessrest/tagflow), a Python library allowing to write HTML documents using a nice context managers syntax.

Styling and components use [Tailwind 4](https://tailwindcss.com) and [DaisyUI 5](https://daisyui.com).

It also includes [HTMX](https://htmx.org) for dynamic content loading, and [Hyperscript](https://hyperscript.org) for quick inline scripts.

## Development

Since it's bundled in our API, you can run the backoffice using the same command:

```bash
uv run task api
```

This will start the API and the backoffice on the same port, and make it available at [http://127.0.0.1:8000/backoffice](http://127.0.0.1:8000/backoffice).

If you add new styles and components, you'll probably need to rebuild the assets bundle, so Tailwind and DaisyUI can detect the new classes:

```bash
uv run task backoffice
```
