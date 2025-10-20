# Emails 📬

This package contains all the email templates used by the server, implemented through [`react-email`](https://react.email).

## Development

Install the dependencies:

```bash
pnpm install
```

Run the react-email development server:

```bash
pnpm dev
```

This will start a development server at [http://localhost:3000](http://localhost:3000) that will automatically update as you make changes to the email templates.

## How to create a new email?

1. On Python's side, in `server/polar/email/schemas.py`, add a new item to `EmailTemplate` and implement a Pydantic schema to describe the props of the email.

```python
# server/polar/email/schemas.py

class EmailTemplate(StrEnum):
    # ...
    customer_greetings = "customer_greetings"

class CustomerGreetingsProps(EmailProps):
    organization: Organization
    url: str

class CustomerGreetingsEmail(BaseModel):
    template: Literal[EmailTemplate.customer_greetings] = EmailTemplate.customer_greetings
    props: CustomerGreetingsProps
```

Don't hesitate to reuse existing schemas for common types like `Organization`, `Product`, etc.

2. Run `pnpm run types` to generate updated TypeScript types based on the Pydantic models.
3. Create a new TSX file in the `src/emails` directory with the name of the email template, as snake case, e.g. `customer_greetings.tsx`.
4. Implement the email template using the `react-email` components.

## How to render it from the Python server?

First, you'll need to build the email templates:

```bash
uv run task emails
```

Then, use the `render_email_template` function:

```python
from polar.email.react import render_email_template
from polar.email.schemas import CustomerGreetingsEmail, CustomerGreetingsProps

body = render_email_template(CustomerGreetingsEmail(
    props=CustomerGreetingsProps.model_validate({
        "email": "john@example.com",
        "organization": organization,
        "url": "https://example.com/welcome",
    })
))
```

## How does it work?

This project entrypoint is actually a CLI tool accepting the name of the email template to render and the props to pass to it.

When building the project, we generate a full NodeJS binary with all our scripts bundled. This magic trick is allowed by [@yao-pkg/pkg](https://github.com/yao-pkg/pkg).

By doing this, we only have to bundle a single binary file in our Python server which we can simply call using `subprocess`.
