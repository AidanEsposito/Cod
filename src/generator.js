// The code generator exports a single function, generate(program), which
// accepts a program representation and returns the JavaScript translation
// as a string.

import { voidType, standardLibrary, tryCatchStatement } from "./core.js"

export default function generate(program) {
  // When generating code for statements, we'll accumulate the lines of
  // the target code here. When we finish generating, we'll join the lines
  // with newlines and return the result.
  const output = []

  // Variable and function names in JS will be suffixed with _1, _2, _3,
  // etc. This is because "switch", for example, is a legal name in Carlos,
  // but not in JS. So, the Carlos variable "switch" must become something
  // like "switch_1". We handle this by mapping each name to its suffix.
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
    // Key idea: when generating an expression, just return the JS string; when
    // generating a statement, write lines of translated JS to the output array.
    program(p) {
      p.statements.forEach(gen)
    },
    functionDeclaration(d) {
      output.push(`function ${gen(d.fun)}(${d.params.map(gen).join(", ")}) {`)
      d.body.forEach(gen)
      output.push("}")
    },
    function(f) {
      return targetName(f)
    },
    functionType(t) {
      return `(${t.paramTypes.map(gen).join(", ")}) => ${gen(t.returnType)}`
    },
    structDecl(d) {
      // The only type declaration in Carlos is the struct! Becomes a JS class.
      output.push(`class ${gen(d.type)} {`)
      output.push(`constructor(${d.type.fields.map(gen).join(",")}) {`)
      for (let field of d.type.fields) {
        output.push(`this[${JSON.stringify(gen(field))}] = ${gen(field)};`)
      }
      output.push("}")
      output.push("}")
    },
    arrayType(t) {
      return `${gen(t.baseType)}[]`
    },
    arrayExpression(e) {
      return `[${e.elements.map(gen).join(",")}]`
    },
    structType(t) {
      return targetName(t)
    },
    field(f) {
      return targetName(f)
    },
    variableDeclaration(d) {
      // We don't care about const vs. let in the generated code! The analyzer has
      // already checked that we never updated a const, so let is always fine.
      output.push(`let ${gen(d.variable)} = ${gen(d.initializer)};`)
    },
    variable(v) {
      // Standard library constants just get special treatment
      if (v === standardLibrary.π) return "Math.PI"
      return targetName(v)
    },
    // ClassDeclaration(d) {
    //   output.push(`class ${gen(d.name)} {`)
    //   d.members.forEach(gen)
    //   output.push("}")
    // },
    // Class(c) {
    //   return targetName(c)
    // },
    // ClassType(t) {
    //   return targetName(t)
    // },
    // Assignment(s) {
    //   output.push(`${gen(s.target)} = ${gen(s.source)};`)
    // },
    ifStatement(s) {
      output.push(`if (${gen(s.test)}) {`)
      s.consequent.forEach(gen)
      if (s.alternate?.kind?.endsWith?.("IfStatement")) {
        output.push("} else")
        gen(s.alternate)
      } else {
        output.push("} else {")
        s.alternate.forEach(gen)
        output.push("}")
      }
    },
    shortIfStatement(s) {
      output.push(`if (${gen(s.test)}) {`)
      s.consequent.forEach(gen)
      output.push("}")
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
    conditional(e) {
      return `((${gen(e.test)}) ? (${gen(e.consequent)}) : (${gen(e.alternate)}))`
    },
    whileStatement(s) {
      output.push(`while (${gen(s.test)}) {`)
      s.body.forEach(gen)
      output.push("}")
    },
    repeatStatement(s) {
      // JS can only repeat n times if you give it a counter variable!
      const i = targetName({ name: "i" })
      output.push(`for (let ${i} = 0; ${i} < ${gen(s.count)}; ${i}++) {`)
      s.body.forEach(gen)
      output.push("}")
    },
    returnStatement(s) {
      output.push(`return ${gen(s.expression)};`)
    },
    shortReturnStatement(s) {
      output.push("return;")
    },
    increment(s) {
      output.push(`${gen(s.variable)}++;`)
    },
    decrement(s) {
      output.push(`${gen(s.variable)}--;`)
    },
    breakStatement(s) {
      output.push("break;")
    },
    continueStatement(s) {
      output.push("continue;")
    },
    tryCatchStatement(s) {
      output.push(`try {`)
      s.tryBlock.forEach(gen)
      output.push(`} catch (e) {`)
      s.catchBlock.forEach(gen)
      output.push("}")
    },
    // catchStatement(s) {
    //   output.push("} catch (e) {")
    //   s.catchBlock.forEach(gen)
    // },
    printStatement(s) {
      output.push(`console.log(${s.args.map(gen).join(", ")});`)
    },
    binaryExpression(e) {
      const op = { "==": "===", "!=": "!==" }[e.op] ?? e.op
      return `(${gen(e.left)} ${op} ${gen(e.right)})`
    },
    unaryExpression(e) {
      const operand = gen(e.operand)
      if (e.op === "some") {
        return operand
      } else if (e.op === "#") {
        return `${operand}.length`
      } else if (e.op === "random") {
        return `((a=>a[~~(Math.random()*a.length)])(${operand}))`
      }
      return `${e.op}(${operand})`
    },
    emptyOptional(e) {
      return "undefined"
    },
    subscriptExpression(e) {
      return `${gen(e.array)}[${gen(e.index)}]`
    },
    memberExpression(e) {
      const object = gen(e.object)
      const field = JSON.stringify(gen(e.field))
      const chain = e.op === "." ? "" : e.op
      return `(${object}${chain}[${field}])`
    },
    functionCall(c) {
      const targetCode = standardFunctions.has(c.callee)
        ? standardFunctions.get(c.callee)(c.args.map(gen))
        : `${gen(c.callee)}(${c.args.map(gen).join(", ")})`
      // Calls in expressions vs in statements are handled differently
      if (c.callee.type.returnType !== voidType) {
        return targetCode
      }
      output.push(`${targetCode};`)
    },
    constructorCall(c) {
      return `new ${gen(c.callee)}(${c.args.map(gen).join(", ")})`
    },
  }

  gen(program)
  return output.join("\n")
}
