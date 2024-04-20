export function program(statements) {
  return { kind: "program", statements }
}

export function functionDeclaration(name, fun, params, body) {
  return { kind: "functionDeclaration", name, fun, params, body }
}

export function fun(name, type) {
  return { kind: "Function", name, type }
}

export function functionType(paramTypes, returnType) {
  return { kind: "functionType", paramTypes, returnType }
}

export function typeDeclaration(type) {
  return { kind: "typeDeclaration", type }
}

export function arrayType(baseType) {
  return { kind: "ArrayType", baseType }
}

export function arrayExpression(elements) {
  return { kind: "arrayExpression", elements }
}

// export function emptyArray(type) {
//   return { kind: "emptyArray", type }
// }

export const voidType = { kind: "VoidType" }
export const numberType = { kind: "NumberType" }
export const stringType = { kind: "StringType" }
export const letType = { kind: "LetType" }
export const constType = { kind: "ConstType" }
export const boolType = { kind: "BoolType" }

export function structType(name, fields) {
  return { kind: "structType", name, fields }
}

export function field(name, type) {
  return { kind: "field", name, type }
}

export function variableDeclaration(variable, initializer) {
  return { kind: "variableDeclaration", variable, initializer }
}

export function variable(name, readOnly, type) {
  return { kind: "variable", name, readOnly, type }
}

export function ifStatement(test, consequent, alternate) {
  return { kind: "ifStatement", test, consequent, alternate }
}

export function shortIfStatement(test, consequent) {
  return { kind: "shortIfStatement", test, consequent }
}

export function nestedIfStatement(test, consequent, alternate) {
  return { kind: "nestedIfStatement", test, consequent, alternate }
}

export function forRangeStatement(iterator, low, op, high, body) {
  return { kind: "forRangeStatement", iterator, low, op, high, body }
}

export function forStatement(iterator, collection, body) {
  return { kind: "forStatement", iterator, collection, body }
}

export function whileStatement(test, body) {
  return { kind: "whileStatement", test, body }
}

export function returnStatement(expression) {
  return { kind: "returnStatement", expression }
}

export function shortReturnStatement() {
  return { kind: "returnStatement" }
}

export function incrementStatement(operand) {
  return { kind: "incrementStatement", operand }
}

export function decrementStatement(operand) {
  return { kind: "decrementStatement", operand }
}

export const breakStatement = { kind: "breakStatement" }

export const continueStatement = { kind: "continueStatement" }

export function tryCatchStatement(tryBlock, catchBlock) {
  return { kind: "tryCatchStatement", tryBlock, catchBlock }
}

export function printStatement(args) {
  return { kind: "printStatement", args }
}

export function binary(op, left, right, type) {
  return { kind: "binaryExpression", op, left, right, type }
}

export function unary(op, operand, type) {
  return { kind: "unaryExpression", op, operand, type }
}

export const standardLibrary = {}

export function functionCall(callee, args) {
  return { kind: "functionCall", callee, args, type: callee.type.returnType }
}

String.prototype.type = stringType
Number.prototype.type = numberType
BigInt.prototype.type = numberType
Boolean.prototype.type = boolType
