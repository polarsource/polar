module.exports = {
  root: true,
  extends: ['next', 'turbo', 'next/core-web-vitals'],
  settings: {
    next: {
      rootDir: ['apps/*/'],
    },
  },
}
