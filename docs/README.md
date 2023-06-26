# Docs

## Deployment

Our docs are hosted by Vercel. However, since we use `poetry` with `pyproject.toml` and Vercel only supports `pip` for Python services, we need to generate a `requirements.txt` unfortunately for Vercel builds to work. Fortunately, we only need to do this if/when we add additional dependencies so it should be very rare.

```bash
./generate_requirements.sh
```

