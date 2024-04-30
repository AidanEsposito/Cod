import {
  voidType,
  standardLibrary,
  tryCatchStatement,
  incrementStatement,
  decrementStatement,
} from "./core.js"

export default function generate(program) {
  const output = []

  const targetName = ((mapping) => {
    return (entity) => {
      if (!mapping.has(entity)) {
        mapping.set(entity, mapping.size + 1)
      }
      return `${entity.name}_${mapping.get(entity)}`
    }
  })(new Map())

  const gen = (node) => generators?.[node?.kind]?.(node) ?? node

  const generators = {
    program(p) {
      p.statements.forEach(gen)
    },
    functionDeclaration(d) {
      output.push(`function ${gen(d.fun)}(${d.params.map(gen).join(", ")}) {`)
      d.body.forEach(gen)
      output.push("}")
    },
    Function(f) {
      return targetName(f)
    },
    arrayExpression(e) {
      return `[${e.elements.map(gen).join(", ")}]`
    },
    variableDeclaration(d) {
      output.push(`let ${gen(d.variable)} = ${gen(d.initializer)};`)
    },
    variable(v) {
      return targetName(v)
    },
    ifStatement(s) {
      output.push(`if (${gen(s.test)}) {`)
      s.consequent.forEach(gen)
      output.push("} else {")
      s.alternate.forEach(gen)
      output.push("}")
    },
    shortIfStatement(s) {
      output.push(`if (${gen(s.test)}) {`)
      s.consequent.forEach(gen)
      output.push("}")
    },
    nestedIfStatement(s) {
      output.push(`if (${gen(s.test)}) {`)
      s.consequent.forEach(gen)
      output.push("} else")
      gen(s.alternate)
    },
    forRangeStatement(s) {
      const i = targetName(s.iterator)
      const op = s.op === "..." ? "<=" : "<"
      output.push(`for (let ${i} = ${gen(s.low)}; ${i} ${op} ${gen(s.high)}; ${i}++) {`)
      s.body.forEach(gen)
      output.push("}")
    },
    forStatement(s) {
      output.push(`for (let ${gen(s.iterator)} of ${gen(s.collection)}) {`)
      s.body.forEach(gen)
      output.push("}")
    },
    whileStatement(s) {
      output.push(`while (${gen(s.test)}) {`)
      s.body.forEach(gen)
      output.push("}")
    },
    returnStatement(s) {
      output.push(`return ${gen(s.expression)};`)
    },
    incrementStatement(s) {
      output.push(`${gen(s.operand)}++;`)
    },
    decrementStatement(s) {
      output.push(`${gen(s.operand)}--;`)
    },
    breakStatement(s) {
      output.push("break;")
    },
    continueStatement(s) {
      output.push("continue;")
    },
    tryCatchStatement(s) {
      output.push(`try {`)
      s.body.forEach(gen)
      output.push(`} catch (e) {`)
      s.handler.forEach(gen)
      output.push("}")
    },
    printStatement(s) {
      output.push(`console.log(${gen(s.args)});`)
    },
    binaryExpression(e) {
      const op = { "==": "===", "!=": "!==" }[e.op] ?? e.op
      return `(${gen(e.left)} ${op} ${gen(e.right)})`
    },
    unaryExpression(e) {
      const operand = gen(e.operand)
      return `${e.op}(${operand})`
    },
    functionCall(c) {
      const targetCode = `${gen(c.callee)}(${c.args.map(gen).join(", ")})`
      if (c.callee.type.returnType !== voidType) {
        return targetCode
      } else {
        output.push(`${targetCode};`)
      }
    },
  }

  gen(program)
  return output.join("\n")
}
