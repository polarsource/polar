export const isMember = (node, objectName, propertyName) =>
  node.type === 'MemberExpression' &&
  node.object.type === 'Identifier' &&
  node.object.name === objectName &&
  node.property.type === 'Identifier' &&
  (propertyName === undefined || node.property.name === propertyName)

const filenameOf = (context) => context.filename ?? context.getFilename()

const isTestFile = (filename) =>
  filename.endsWith('.test.ts') || filename.includes('/utils/test-utils/')

export const inDirectory = (context, directory) => {
  const filename = filenameOf(context)
  return filename.includes(`/src/${directory}/`) && !isTestFile(filename)
}

export const isFile = (context, ...paths) => {
  const filename = filenameOf(context)
  return paths.some((path) => filename.endsWith(`/src/${path}`))
}
