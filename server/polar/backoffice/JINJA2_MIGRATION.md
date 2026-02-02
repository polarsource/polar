# Jinja2 Template Migration Guide

This document provides guidance for converting backoffice endpoints from Tagflow to Jinja2.

## Overview

The backoffice now supports both Tagflow and Jinja2 templates during the migration period. New endpoints should use Jinja2, and existing endpoints can be converted gradually.

## Key Components

### 1. `render_page()` Utility Function

Use this helper function to render pages with proper typing and automatic context:

```python
from polar.backoffice.templates import render_page
from polar.backoffice.navigation import NAVIGATION

@router.get("/example")
async def example_page(request: Request):
    return render_page(
        request,
        "pages/example.html",
        breadcrumbs=[("Example", "/example")],
        navigation=NAVIGATION,
        active_route_name="example:list",
        # Additional context
        custom_data="value",
    )
```

**Parameters:**
- `request`: FastAPI Request object (required)
- `template_name`: Path to template file (required)
- `breadcrumbs`: List of (title, href) tuples - "Polar Backoffice" is auto-prepended
- `navigation`: Navigation menu items (usually `NAVIGATION`)
- `active_route_name`: Current route name for menu highlighting
- `**context`: Any additional context variables

### 2. Page Template Structure

Templates should extend `layouts/page.html` which automatically handles HTMX partial updates:

```jinja2
{% extends "layouts/page.html" %}

{% block content %}
<h1>My Page</h1>
<p>Content here</p>
{% endblock %}
```

The `page.html` layout automatically:
- Renders full page layout for normal requests
- Renders partial content + OOB swaps for HTMX boosted requests
- Updates breadcrumbs, title, and navigation menu

### 3. Component Macros

Use macros instead of Python context managers:

**Button:**
```jinja2
{% from "components/button.html" import button %}

{% call button(variant="primary", size="lg", type="submit") %}
    Submit Form
{% endcall %}
```

**Alert:**
```jinja2
{% from "components/alert.html" import alert %}

{% call alert(variant="success") %}
    Operation completed successfully!
{% endcall %}
```

## Migration Steps

### Step 1: Create the Jinja2 Template

Create a new template file in `templates/pages/`:

```jinja2
{# templates/pages/users/list.html #}
{% extends "layouts/page.html" %}

{% block content %}
<h1>Users List</h1>
{# Your content here #}
{% endblock %}
```

### Step 2: Update the Endpoint

Convert the endpoint from Tagflow to Jinja2:

**Before (Tagflow):**
```python
@router.get("/", name="users:list")
async def list(request: Request, session: AsyncSession) -> None:
    users = await get_users(session)
    
    with layout(request, [("Users", "/users")], "users:list"):
        with tag.h1():
            text("Users List")
        for user in users:
            with tag.div():
                text(user.email)
```

**After (Jinja2):**
```python
@router.get("/", name="users:list")
async def list(request: Request, session: AsyncSession):
    users = await get_users(session)
    
    return render_page(
        request,
        "pages/users/list.html",
        breadcrumbs=[("Users", "/users")],
        navigation=NAVIGATION,
        active_route_name="users:list",
        users=users,
    )
```

### Step 3: Move Logic to Template

Convert Tagflow context managers to Jinja2 syntax in the template:

```jinja2
{% extends "layouts/page.html" %}

{% block content %}
<h1>Users List</h1>
{% for user in users %}
<div>{{ user.email }}</div>
{% endfor %}
{% endblock %}
```

## Component Conversion Examples

### Buttons and Forms

**Tagflow:**
```python
with tag.form(method="post", action="/submit"):
    with button(variant="primary", type="submit"):
        text("Submit")
```

**Jinja2:**
```jinja2
{% from "components/button.html" import button %}

<form method="post" action="/submit">
    {% call button(variant="primary", type="submit") %}
        Submit
    {% endcall %}
</form>
```

### Conditional Rendering

**Tagflow:**
```python
if user.is_admin:
    with tag.span(classes="badge badge-success"):
        text("Admin")
```

**Jinja2:**
```jinja2
{% if user.is_admin %}
<span class="badge badge-success">Admin</span>
{% endif %}
```

### Loops

**Tagflow:**
```python
for item in items:
    with tag.li():
        text(item.name)
```

**Jinja2:**
```jinja2
{% for item in items %}
<li>{{ item.name }}</li>
{% endfor %}
```

## Import Guidelines

**Always put imports at the module top level:**

```python
# ✅ Good
from polar.backoffice.templates import render_page
from polar.backoffice.navigation import NAVIGATION

@router.get("/")
async def index(request: Request):
    return render_page(...)

# ❌ Bad
@router.get("/")
async def index(request: Request):
    from polar.backoffice.templates import render_page  # Don't do this
    return render_page(...)
```

## HTMX Integration

The templates automatically handle HTMX boosted requests:

- **Full page request**: Complete HTML with `<html>`, `<body>`, sidebar, etc.
- **HTMX boosted request** (HX-Boosted + HX-Target=content):
  - Content block only
  - Out-of-band swap for page title
  - Out-of-band swap for navigation menu

This happens automatically when using `layouts/page.html` - no special handling needed in your template!

## Testing

Create tests using the `backoffice_client` fixture:

```python
async def test_my_page(backoffice_client: AsyncClient) -> None:
    response = await backoffice_client.get("/my-page")
    assert response.status_code == 200
    content = response.content.decode()
    assert "Expected Content" in content
```

## Next Steps

1. Convert simple pages first (dashboards, simple lists)
2. Build up a library of component macros for complex components
3. Convert more complex pages with forms and interactions
4. Once all endpoints are converted, remove Tagflow dependencies
