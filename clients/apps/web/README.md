# Web Client

This directory contains the source code for the web client of the Polar project.

## Structure and Purpose

The `clients/apps/web` directory is structured as follows:

- `src/`: Contains the source code for the web client.
- `public/`: Contains static assets such as images and fonts.
- `pages/`: Contains the Next.js pages for the web client.
- `components/`: Contains reusable React components used throughout the web client.
- `styles/`: Contains the CSS and SCSS files for styling the web client.
- `utils/`: Contains utility functions and helper modules used in the web client.

The purpose of the web client is to provide a user interface for interacting with the Polar project. It allows users to browse and manage their projects, view and create issues, and interact with other features of the Polar platform.

## Configuration and Deployment

To configure and deploy the web client in production, follow these steps:

1. **Environment Setup**: Ensure that your production environment is properly configured with the necessary environment variables. Create a `.env.production` file in the root of the `clients/apps/web` directory and set the following variables:

   ```env
   NEXT_PUBLIC_API_URL=https://api.polar.sh
   NEXT_PUBLIC_SENTRY_DSN=<your-sentry-dsn>
   NEXT_PUBLIC_STRIPE_PUBLIC_KEY=<your-stripe-public-key>
   ```

2. **Build the Web Client**: Run the following command to build the web client for production:

   ```bash
   npm run build
   ```

3. **Start the Web Client**: Run the following command to start the web client in production mode:

   ```bash
   npm run start
   ```

4. **Deploy to Production**: Use your preferred deployment method to deploy the web client to your production environment. This can include deploying to a cloud provider such as Vercel, Netlify, or AWS, or using a containerization platform such as Docker.

For detailed deployment instructions, refer to the [Deployment Guide](../../../../docs/DEPLOYMENT.md).
