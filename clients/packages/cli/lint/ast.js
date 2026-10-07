export const propertyName = (node) => {
  if (node.type !== 'MemberExpression') return undefined
  if (!node.computed && node.property.type === 'Identifier') {
    return node.property.name
  }
  if (node.computed && node.property.type === 'Literal') {
    return typeof node.property.value === 'string'
      ? node.property.value
      : undefined
  }
  return undefined
}

export const isMember = (node, objectName, expected) => {
  if (node.type !== 'MemberExpression') return false
  if (node.object.type !== 'Identifier' || node.object.name !== objectName) {
    return false
  }
  const name = propertyName(node)
  return name !== undefined && (expected === undefined || name === expected)
}

const filenameOf = (context) => context.filename ?? context.getFilename()

const isTestFile = (filename) =>
  filename.endsWith('.test.ts') || filename.includes('/utils/test-utils/')

export const isTest = (context) => isTestFile(filenameOf(context))

export const inSource = (context) => filenameOf(context).includes('/src/')

export const inDirectory = (context, directory) => {
  const filename = filenameOf(context)
  return filename.includes(`/src/${directory}/`) && !isTestFile(filename)
}

export const isFile = (context, ...paths) => {
  const filename = filenameOf(context)
  return paths.some((path) => filename.endsWith(`/src/${path}`))
}

const sourceOf = (node) =>
  node.source?.type === 'Literal' && typeof node.source.value === 'string'
    ? node.source.value
    : undefined

const specifiersTypeOnly = (specifiers, kind) =>
  specifiers.length > 0 &&
  specifiers.every((specifier) => specifier[kind] === 'type')

export const typeOnly = (node) =>
  node.type === 'TSImportType' ||
  node.importKind === 'type' ||
  node.exportKind === 'type' ||
  (node.type === 'ImportDeclaration' &&
    specifiersTypeOnly(node.specifiers, 'importKind')) ||
  (node.type === 'ExportNamedDeclaration' &&
    specifiersTypeOnly(node.specifiers, 'exportKind'))

export const onModuleReference = (visit) => {
  const handle = (node) => {
    const source = sourceOf(node)
    if (source !== undefined) visit(node, source)
  }
  return {
    ImportDeclaration: handle,
    ImportExpression: handle,
    ExportNamedDeclaration: handle,
    ExportAllDeclaration: handle,
    TSImportType: handle,
  }
}
