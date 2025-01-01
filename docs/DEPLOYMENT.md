# Deployment Guide

This document provides a comprehensive guide for deploying the Polar project in a production environment. It includes information on environment setup, configuration, and deployment steps.

## Environment Setup

Before deploying the Polar project, ensure that your production environment is properly configured with the necessary environment variables. Below are the required environment variables for different components of the project.

### Web Client

Create a `.env.production` file in the root of the `clients/apps/web` directory and set the following variables:

```env
NEXT_PUBLIC_API_URL=https://api.polar.sh
NEXT_PUBLIC_SENTRY_DSN=<your-sentry-dsn>
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=<your-stripe-public-key>
```

### Server

Create a `.env.production` file in the root of the `server` directory and set the following variables:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/polar
REDIS_URL=redis://localhost:6379/0
GITHUB_APP_ID=<your-github-app-id>
GITHUB_APP_PRIVATE_KEY=<your-github-app-private-key>
```

## Configuration

### Web Client

To configure the web client for production, follow these steps:

1. **Build the Web Client**: Run the following command to build the web client for production:

   ```bash
   npm run build
   ```

2. **Start the Web Client**: Run the following command to start the web client in production mode:

   ```bash
   npm run start
   ```

### Server

To configure the server for production, follow these steps:

1. **Build the Server**: Run the following command to build the server for production:

   ```bash
   docker build -t polar-server .
   ```

2. **Run Database Migrations**: Run the following command to apply database migrations:

   ```bash
   docker run --env-file .env.production polar-server uv run task db_migrate
   ```

3. **Start the Server**: Run the following command to start the server in production mode:

   ```bash
   docker run --env-file .env.production -p 8000:8000 polar-server uv run task api
   ```

## Deployment Steps

### Web Client

1. **Deploy to Production**: Use your preferred deployment method to deploy the web client to your production environment. This can include deploying to a cloud provider such as Vercel, Netlify, or AWS, or using a containerization platform such as Docker.

### Server

1. **Deploy to Production**: Use your preferred deployment method to deploy the server to your production environment. This can include deploying to a cloud provider such as AWS, Google Cloud, or Azure, or using a containerization platform such as Kubernetes.

## Additional Information

For more detailed information on configuring and deploying specific components of the Polar project, refer to the following documentation:

- [Web Client README](../clients/apps/web/README.md)
- [Server README](../server/README.md)
- [GitHub Integration Guide](../clients/apps/web/src/app/(main)/docs/(mdx)/github/install/page.mdx)
- [Checkout Process Guide](../clients/apps/web/src/app/(main)/docs/(mdx)/checkout/page.mdx)
- [Issue Funding Guide](../clients/apps/web/src/app/(main)/docs/(mdx)/issue-funding/page.mdx)
