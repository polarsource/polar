export const CONFIG = {
  BASE_URL: process?.env?.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000',
  GITHUB_INSTALLATION_URL:
    process?.env?.NEXT_PUBLIC_GITHUB_INSTALLATION_URL ||
    'https://github.com/apps/polar-code/installations/new',
}
