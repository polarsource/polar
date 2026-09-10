export const isMember = (node, objectName, propertyName) =>
  node.type === 'MemberExpression' &&
  node.object.type === 'Identifier' &&
  node.object.name === objectName &&
  node.property.type === 'Identifier' &&
  (propertyName === undefined || node.property.name === propertyName)
