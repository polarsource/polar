from fastapi import Request

from .versioned_static import VersionedStaticFiles


def static_url(request: Request, path: str) -> str:
    """Generate a static file URL (automatically versioned for CSS/JS)."""
    base_url = str(request.url_for("static", path=path))

    # Add versioning for CSS and JS files
    if path.endswith((".css", ".js")):
        # Get the static files mount to access versioning
        for route in request.app.routes:
            if hasattr(route, "path") and route.path == "/static":
                if isinstance(route.app, VersionedStaticFiles):
                    version = route.app.get_file_version(path)
                    return f"{base_url}?v={version}"
                break

    return base_url
