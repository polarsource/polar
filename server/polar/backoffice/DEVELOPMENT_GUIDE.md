# Backoffice Development Guide

This guide covers everything you need to know to create and maintain backoffice pages for the Polar billing platform.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Creating a New Module](#creating-a-new-module)
3. [Common Patterns](#common-patterns)
4. [Components Reference](#components-reference)
5. [Forms and Validation](#forms-and-validation)
6. [HTMX Integration](#htmx-integration)
7. [Styling Guidelines](#styling-guidelines)
8. [Best Practices](#best-practices)

## Architecture Overview

The backoffice is built using:

- **FastAPI** for HTTP routing and request handling
- **Tagflow** for server-side HTML rendering using Python context managers
- **DaisyUI + Tailwind CSS** for consistent styling and components
- **HTMX** for dynamic content loading without full page reloads
- **Hyperscript** for simple client-side interactions

### File Structure

```
polar/backoffice/
├── __init__.py              # FastAPI app configuration
├── README.md               # Basic setup instructions
├── DEVELOPMENT_GUIDE.md    # This file
├── components/             # Reusable UI components
│   ├── _base.py           # HTML document structure
│   ├── _layout.py         # Page layout with sidebar
│   ├── _datatable.py      # Data tables with sorting/pagination
│   ├── _button.py         # Styled buttons
│   ├── _modal.py          # Dialog boxes
│   └── ...
├── dependencies.py         # Authentication and common dependencies
├── layout.py              # Layout context manager
├── navigation.py          # Sidebar navigation configuration
├── forms.py               # Form base classes and utilities
├── formatters.py          # Value formatting utilities
├── responses.py           # Custom response types
├── toast.py               # Flash message system
└── {entity}/              # Entity-specific modules
    ├── __init__.py
    ├── endpoints.py       # Routes and view logic
    └── forms.py           # Entity-specific forms (optional)
```

## Creating a New Module

Follow these steps to add a new entity to the backoffice:

### 1. Create the Module Structure

```bash
mkdir polar/backoffice/my_entity
touch polar/backoffice/my_entity/__init__.py
touch polar/backoffice/my_entity/endpoints.py
touch polar/backoffice/my_entity/forms.py  # Optional
```

### 2. Define Endpoints

Create `my_entity/endpoints.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, ValidationError
from tagflow import tag, text

from polar.kit.pagination import PaginationParamsQuery
from polar.models import MyEntity
from polar.my_entity.repository import MyEntityRepository
from polar.my_entity.sorting import MyEntitySortProperty
from polar.postgres import AsyncSession, get_db_session

from ..components import datatable, description_list, button
from ..layout import layout
from ..responses import HXRedirectResponse
from ..toast import add_toast

router = APIRouter()

@router.get("/", name="my_entity:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    query: str | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = MyEntityRepository.from_session(session)
    statement = repository.get_base_statement()

    # Add search functionality
    if query:
        statement = statement.where(MyEntity.name.ilike(f"%{query}%"))

    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [("My Entities", str(request.url_for("my_entity:list")))],
        "my_entity:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("My Entities")

            # Search form
            with tag.form(method="GET", classes="w-full"):
                with tag.div(classes="flex flex-row gap-2"):
                    with tag.input(
                        type="search",
                        name="query",
                        value=query or "",
                        placeholder="Search entities...",
                        classes="input input-bordered flex-1",
                    ):
                        pass
                    with button(variant="primary", type="submit"):
                        text("Search")

            # Data table
            with datatable.Datatable[MyEntity, MyEntitySortProperty](
                datatable.DatatableAttrColumn(
                    "id", "ID", href_route_name="my_entity:get", clipboard=True
                ),
                datatable.DatatableAttrColumn("name", "Name"),
                datatable.DatatableDateTimeColumn("created_at", "Created At"),
                datatable.DatatableActionsColumn(
                    "",
                    datatable.DatatableActionHTMX(
                        "Delete",
                        lambda r, i: str(r.url_for("my_entity:delete", id=i.id)),
                        target="#modal",
                    ),
                ),
            ).render(request, items):
                pass

            # Pagination
            with datatable.pagination(request, pagination, count):
                pass

@router.api_route("/{id}", name="my_entity:get", methods=["GET", "POST"])
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = MyEntityRepository.from_session(session)
    entity = await repository.get_by_id(id)

    if entity is None:
        raise HTTPException(status_code=404)

    # Handle form submission for updates
    validation_error: ValidationError | None = None
    if request.method == "POST":
        try:
            form_data = await request.form()
            form = UpdateMyEntityForm.model_validate_form(form_data)

            # Update entity
            await repository.update(entity, form.model_dump())
            add_toast(request, "Entity updated successfully", "success")
            return HXRedirectResponse(request.url)
        except ValidationError as e:
            validation_error = e

    with layout(
        request,
        [
            (entity.name, str(request.url)),
            ("My Entities", str(request.url_for("my_entity:list"))),
        ],
        "my_entity:get",
    ):
        with tag.div(classes="flex flex-col gap-8"):
            # Entity details
            with tag.h1(classes="text-4xl"):
                text(entity.name)

            with description_list.DescriptionList[MyEntity](
                description_list.DescriptionListAttrItem("id", "ID", clipboard=True),
                description_list.DescriptionListAttrItem("name", "Name"),
                description_list.DescriptionListDateTimeItem("created_at", "Created At"),
            ).render(request, entity):
                pass

            # Update form
            with tag.h2(classes="text-2xl"):
                text("Update Entity")

            with UpdateMyEntityForm.render(
                data=entity,
                validation_error=validation_error,
                method="POST",
                hx_post=str(request.url),
                hx_target="#content",
            ):
                with button(variant="primary", type="submit"):
                    text("Update")

@router.get("/{id}/delete", name="my_entity:delete")
async def delete_confirmation(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = MyEntityRepository.from_session(session)
    entity = await repository.get_by_id(id)

    if entity is None:
        raise HTTPException(status_code=404)

    with modal("Confirm Delete", open=True):
        with tag.p(classes="mb-4"):
            text(f"Are you sure you want to delete '{entity.name}'? This action cannot be undone.")

        with tag.div(classes="modal-action"):
            with tag.form(method="dialog"):
                with button(variant="neutral"):
                    text("Cancel")

            with tag.form(
                method="POST",
                hx_delete=str(request.url_for("my_entity:delete_confirm", id=id)),
                hx_target="body",
                hx_swap="outerHTML"
            ):
                with button(variant="error", type="submit"):
                    text("Delete")

@router.delete("/{id}/delete", name="my_entity:delete_confirm")
async def delete_confirm(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = MyEntityRepository.from_session(session)
    entity = await repository.get_by_id(id)

    if entity is None:
        raise HTTPException(status_code=404)

    await repository.delete(entity)
    add_toast(request, f"'{entity.name}' deleted successfully", "success")
    return HXRedirectResponse(str(request.url_for("my_entity:list")))
```

### 3. Create Forms (Optional)

Create `my_entity/forms.py`:

```python
from .. import forms

class UpdateMyEntityForm(forms.BaseForm):
    name: str
    description: str | None = None
```

### 4. Register the Router

Add to `__init__.py`:

```python
from .my_entity.endpoints import router as my_entity_router

app.include_router(my_entity_router, prefix="/my-entity")
```

### 5. Add to Navigation

Add to `navigation.py`:

```python
from .components import navigation

NAVIGATION = [
    # ... existing items
    navigation.NavigationItem(
        "My Entities",
        "my_entity:list",
        active_route_name_prefix="my_entity:"
    ),
]
```

## Common Patterns

### List View Pattern

All list views should follow this structure:

```python
@router.get("/", name="entity:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: SortingParams,  # If sorting is supported
    query: str | None = Query(None),  # Search query
    filter_param: FilterType | None = Query(None),  # Additional filters
    session: AsyncSession = Depends(get_db_session),
) -> None:
    # 1. Get repository
    repository = EntityRepository.from_session(session)
    statement = repository.get_base_statement()

    # 2. Apply filters
    if query:
        # Add search logic
        pass
    if filter_param:
        # Add filter logic
        pass

    # 3. Apply sorting (if supported)
    if sorting:
        statement = repository.apply_sorting(statement, sorting)

    # 4. Paginate
    items, count = await repository.paginate(statement, pagination.limit, pagination.page)

    # 5. Render
    with layout(request, breadcrumbs, route_name):
        # Header
        # Filters/Search
        # Data table
        # Pagination
        pass
```

### Detail View Pattern

Detail views typically handle both GET (display) and POST (update):

```python
@router.api_route("/{id}", name="entity:get", methods=["GET", "POST"])
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    # 1. Get entity
    entity = await repository.get_by_id(id)
    if not entity:
        raise HTTPException(status_code=404)

    # 2. Handle form submission
    validation_error: ValidationError | None = None
    if request.method == "POST":
        try:
            form_data = await request.form()
            form = UpdateForm.model_validate_form(form_data)
            # Process form
            return success_response
        except ValidationError as e:
            validation_error = e

    # 3. Render
    with layout(request, breadcrumbs, route_name):
        # Entity details
        # Related data
        # Update forms
        pass
```

### Modal Action Pattern

For destructive actions, use confirmation modals:

```python
@router.get("/{id}/action", name="entity:action")
async def action_confirmation(request: Request, id: UUID4) -> None:
    with modal("Confirm Action", open=True):
        with tag.p():
            text("Confirmation message")

        with tag.div(classes="modal-action"):
            with tag.form(method="dialog"):
                with button(variant="neutral"):
                    text("Cancel")

            with tag.form(method="POST", hx_post=confirm_url):
                with button(variant="error", type="submit"):
                    text("Confirm")

@router.post("/{id}/action", name="entity:action_confirm")
async def action_confirm(request: Request, id: UUID4) -> Any:
    # Perform action
    # Add toast message
    # Redirect
    pass
```

## Components Reference

### Layout Components

#### `layout(request, breadcrumbs, active_route_name)`

Main page layout with sidebar navigation.

```python
with layout(
    request,
    [("Current Page", current_url), ("Parent Page", parent_url)],
    "route:name"
):
    # Page content
    pass
```

### Data Display Components

#### `Datatable`

Sortable, paginated data tables.

```python
with datatable.Datatable[Model, SortProperty](
    datatable.DatatableAttrColumn("attr", "Label", clipboard=True),
    datatable.DatatableDateTimeColumn("created_at", "Created"),
    datatable.DatatableActionsColumn("", action1, action2),
).render(request, items, sorting=sorting):
    pass
```

#### `DescriptionList`

Key-value pairs for displaying entity details.

```python
with description_list.DescriptionList[Model](
    description_list.DescriptionListAttrItem("id", "ID", clipboard=True),
    description_list.DescriptionListDateTimeItem("created_at", "Created"),
).render(request, item):
    pass
```

### Form Components

#### `BaseForm`

Auto-generates forms from Pydantic models.

```python
class MyForm(BaseForm):
    name: str
    email: Annotated[str, Field(title="Email Address")]
    amount: Annotated[int, CurrencyField(), CurrencyValidator]

# Usage
with MyForm.render(data=data, validation_error=error, method="POST"):
    with button(variant="primary", type="submit"):
        text("Submit")
```

### UI Components

#### `button()`

Styled buttons with variants.

```python
with button(variant="primary", size="lg", type="submit"):
    text("Save Changes")
```

#### `modal()`

Dialog boxes for confirmations and forms.

```python
with modal("Dialog Title", open=True):
    with tag.p():
        text("Dialog content")

    with tag.div(classes="modal-action"):
        with button(variant="primary"):
            text("OK")
```

## Forms and Validation

### Form Field Types

- `InputField()` - Text, email, password, etc.
- `SelectField(options)` - Dropdown selections
- `CheckboxField()` - Boolean checkboxes
- `CurrencyField()` - Currency inputs (handles cents ↔ dollars conversion)

### Custom Field Types

```python
from typing import Annotated
from .. import forms

class MyForm(forms.BaseForm):
    name: str
    status: Annotated[str, forms.SelectField([
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("pending", "Pending"),
    ])]
    amount: Annotated[int, forms.CurrencyField(), CurrencyValidator]
```

### Validation Error Handling

```python
validation_error: ValidationError | None = None
if request.method == "POST":
    try:
        form_data = await request.form()
        form = MyForm.model_validate_form(form_data)
        # Process valid data
    except ValidationError as e:
        validation_error = e

with MyForm.render(data=data, validation_error=validation_error):
    # Errors are automatically displayed next to fields
    pass
```

## HTMX Integration

The backoffice uses HTMX for enhanced interactivity:

### Boosted Navigation

All internal links are automatically "boosted" for SPA-like navigation.

### Form Submissions

Use HTMX attributes for dynamic form handling:

```python
with tag.form(
    method="POST",
    hx_post=str(request.url),
    hx_target="#content",  # Update specific element
):
    # Form fields
    pass
```

### Modal Actions

Use HTMX to load modals dynamically:

```python
datatable.DatatableActionHTMX(
    "Delete",
    lambda r, i: str(r.url_for("entity:delete", id=i.id)),
    target="#modal",  # Load into modal container
)
```

## Styling Guidelines

### Tailwind Classes

Use Tailwind utility classes for spacing, sizing, and layout:

```python
with tag.div(classes="flex flex-col gap-4 p-4"):
    with tag.h1(classes="text-4xl font-bold"):
        text("Title")

    with tag.div(classes="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"):
        # Responsive grid
        pass
```

### Responsive Design

Design mobile-first with responsive breakpoints:

```python
with tag.div(classes="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"):
    # 1 column on mobile, 2 on tablet, 4 on desktop
    pass
```

### Color Variants

Use semantic color variants:

- `primary` - Main brand color
- `success` - Green for positive actions
- `warning` - Yellow/orange for warnings
- `error` - Red for destructive actions
- `neutral` - Gray for secondary actions

## Best Practices

### Components and UI

#### Description List Items

- Prefer using `DescriptionListAttrItem` with dot notation over custom subclasses
- `attr` parameter supports dot notation (e.g., `"customer.email"`, `"billing_address.line1"`)
- Only create custom description list items when you need complex rendering logic
- Use built-in items like `DescriptionListCurrencyItem` and `DescriptionListDateTimeItem` when available

```python
# Preferred - simple and clear
description_list.DescriptionListAttrItem("customer.email", "Customer")
description_list.DescriptionListAttrItem("billing_address.city", "City")

# Avoid - unnecessary custom subclass
class CustomerDescriptionListItem(description_list.DescriptionListAttrItem[Order]):
    def render(self, request: Request, item: Order) -> Generator[None] | None:
        text(item.customer.email)
```

#### Status Badges

- Use DaisyUI badge classes instead of pure Tailwind CSS
- Use contextual colors: `badge-success`, `badge-warning`, `badge-error`, `badge-info`, `badge-neutral`

```python
@contextlib.contextmanager
def order_status_badge(status: OrderStatus) -> Generator[None]:
    with tag.div(classes="badge"):
        if status == OrderStatus.paid:
            classes("badge-success")
        elif status == OrderStatus.pending:
            classes("badge-warning")
        # ... etc
        text(status.value.replace("_", " ").title())
    yield

# Avoid pure Tailwind classes
# with tag.span(classes="bg-green-100 text-green-800 px-2 py-1 rounded"):
```

#### Cards for Content Organization

- Use DaisyUI card components to organize content sections in detail pages
- Follow the pattern from `subscriptions/endpoints.py` and `orders/endpoints.py` for consistency
- Use `card`, `card-border`, `card-body`, and `card-title` classes

**Basic Card Structure:**

```python
# Preferred - DaisyUI card structure
with tag.div(classes="card card-border w-full shadow-sm"):
    with tag.div(classes="card-body"):
        with tag.h2(classes="card-title"):
            text("Section Title")
        # Content here (description lists, etc.)

# Avoid - custom styling with multiple classes
# with tag.div(classes="bg-white shadow rounded-lg p-6"):
#     with tag.h2(classes="text-lg font-medium mb-4"):
```

**Layout Patterns:**

For detail pages, use a grid layout for the main content:

```python
# Two-column layout for main sections
with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
    # Main details card
    with tag.div(classes="card card-border w-full shadow-sm"):
        # ...

    # Related information cards
    with tag.div(classes="card card-border w-full shadow-sm"):
        # ...

# Full-width sections below main grid
with tag.div(classes="flex flex-col gap-4 mt-6"):
    # Additional cards (billing, tax info, etc.)
    if condition:
        with tag.div(classes="card card-border w-full shadow-sm"):
            # ...
```

**Card Content Organization:**

- Use separate cards for logically distinct information (Customer, Product, Financial, etc.)
- Keep related information together within a single card
- Use conditional cards for optional sections (billing info, tax details)
- Maintain consistent card structure across all detail pages

### Model Properties

#### Use Existing Properties and Methods

- Check the model for existing computed properties before calculating values manually
- Many models have hybrid properties and methods for common calculations

```python
# Preferred - use existing properties
currency(order.total_amount, order.currency)
currency(order.get_remaining_balance(), order.currency)

# Avoid - manual calculation
total = order.subtotal_amount - order.discount_amount + order.tax_amount
```

### Security

- All endpoints automatically require admin authentication
- Use proper HTTP methods (GET for display, POST for mutations)
- Validate all form inputs using Pydantic models
