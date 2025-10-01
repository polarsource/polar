module.exports = {
  root: true,
  extends: ['next', 'turbo', 'prettier', 'next/core-web-vitals'],
  settings: {
    next: {
      rootDir: ['apps/*/'],
    },
  },
}
