// The code generator exports a single function, generate(program), which
// accepts a program representation and returns the JavaScript translation
// as a string.

import { voidType, standardLibrary, classDeclaration, tryCatchStatement } from "./core.js"

export default function generate(program) {
  // When generating code for statements, we'll accumulate the lines of
  // the target code here. When we finish generating, we'll join the lines
  // with newlines and return the result.
  const output = []

  // Variable and function names in JS will be suffixed with _1, _2, _3,
  // etc. This is because "switch", for example, is a legal name in Carlos,
  // but not in JS. So, the Carlos variable "switch" must become something
  // like "switch_1". We handle this by mapping each name to its suffix.
  const targetName = (mapping => {
    return entity => {
      if (!mapping.has(entity)) {
        mapping.set(entity, mapping.size + 1)
      }
      return `${entity.name}_${mapping.get(entity)}`
    }
  })(new Map())

  const gen = node => generators?.[node?.kind]?.(node) ?? node

  const generators = {
    // Key idea: when generating an expression, just return the JS string; when
    // generating a statement, write lines of translated JS to the output array.
    Program(p) {
      p.statements.forEach(gen)
    },
     FunctionDeclaration(d) {
      output.push(`function ${gen(d.fun)}(${d.params.map(gen).join(", ")}) {`)
      d.body.forEach(gen)
      output.push("}")
    },
    Function(f) {
      return targetName(f)
    },
    FunctionType(t) {
      return `(${t.paramTypes.map(gen).join(", ")}) => ${gen(t.returnType)}`
    },
    TypeDeclaration(d) {
      // The only type declaration in Carlos is the struct! Becomes a JS class.
      output.push(`class ${gen(d.type)} {`)
      output.push(`constructor(${d.type.fields.map(gen).join(",")}) {`)
      for (let field of d.type.fields) {
        output.push(`this[${JSON.stringify(gen(field))}] = ${gen(field)};`)
      }
      output.push("}")
      output.push("}")
    },
    ArrayType(t) {
      return `${gen(t.baseType)}[]`
    },
     ArrayExpression(e) {
      return `[${e.elements.map(gen).join(",")}]`
    },
    EmptyArray(e) {
      return "[]"
    },
    StructType(t) {
      return targetName(t)
    },
    Field(f) {
      return targetName(f)
    },
     VariableDeclaration(d) {
      // We don't care about const vs. let in the generated code! The analyzer has
      // already checked that we never updated a const, so let is always fine.
      output.push(`let ${gen(d.variable)} = ${gen(d.initializer)};`)
    },
    Variable(v) {
      // Standard library constants just get special treatment
      if (v === standardLibrary.π) return "Math.PI"
      return targetName(v)
    },
    ClassDeclaration(d) {
      output.push(`class ${gen(d.name)} {`)
      d.members.forEach(gen)
      output.push("}")
    },
    Class(c) {
      return targetName(c)
    },
    ClassType(t) {
      return targetName(t)
    },
    Assignment(s) {
      output.push(`${gen(s.target)} = ${gen(s.source)};`)
    },
    IfStatement(s) {
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
    ShortIfStatement(s) {
      output.push(`if (${gen(s.test)}) {`)
      s.consequent.forEach(gen)
      output.push("}")
    },
    ForRangeStatement(s) {
      const i = targetName(s.iterator)
      const op = s.op === "..." ? "<=" : "<"
      output.push(`for (let ${i} = ${gen(s.low)}; ${i} ${op} ${gen(s.high)}; ${i}++) {`)
      s.body.forEach(gen)
      output.push("}")
    },
    ForStatement(s) {
      output.push(`for (let ${gen(s.iterator)} of ${gen(s.collection)}) {`)
      s.body.forEach(gen)
      output.push("}")
    },
    Conditional(e) {
      return `((${gen(e.test)}) ? (${gen(e.consequent)}) : (${gen(e.alternate)}))`
    },
    WhileStatement(s) {
      output.push(`while (${gen(s.test)}) {`)
      s.body.forEach(gen)
      output.push("}")
    },
    RepeatStatement(s) {
      // JS can only repeat n times if you give it a counter variable!
      const i = targetName({ name: "i" })
      output.push(`for (let ${i} = 0; ${i} < ${gen(s.count)}; ${i}++) {`)
      s.body.forEach(gen)
      output.push("}")
    },
    ReturnStatement(s) {
      output.push(`return ${gen(s.expression)};`)
    },
    ShortReturnStatement(s) {
      output.push("return;")
    },
    Increment(s) {
      output.push(`${gen(s.variable)}++;`)
    },
    Decrement(s) {
      output.push(`${gen(s.variable)}--;`)
    },
    BreakStatement(s) {
      output.push("break;")
    },
    ContinueStatement(s) {
      output.push("continue;")
    },
    tryCatchStatement(s) {
      output.push(`try {`)
      s.tryBlock.forEach(gen)
      output.push(`} catch (e) {`)
      s.catchBlock.forEach(gen)
      output.push("}")
    },
    CatchStatement(s) {
      output.push("} catch (e) {")
      s.catchBlock.forEach(gen)
    },
    PrintStatement(s) {
      output.push(`console.log(${s.args.map(gen).join(", ")});`)
    },
    BinaryExpression(e) {
      const op = { "==": "===", "!=": "!==" }[e.op] ?? e.op
      return `(${gen(e.left)} ${op} ${gen(e.right)})`
    },
    UnaryExpression(e) {
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
    EmptyOptional(e) {
      return "undefined"
    },
    SubscriptExpression(e) {
      return `${gen(e.array)}[${gen(e.index)}]`
    },
    MemberExpression(e) {
      const object = gen(e.object)
      const field = JSON.stringify(gen(e.field))
      const chain = e.op === "." ? "" : e.op
      return `(${object}${chain}[${field}])`
    },
    FunctionCall(c) {
      const targetCode = standardFunctions.has(c.callee)
        ? standardFunctions.get(c.callee)(c.args.map(gen))
        : `${gen(c.callee)}(${c.args.map(gen).join(", ")})`
      // Calls in expressions vs in statements are handled differently
      if (c.callee.type.returnType !== voidType) {
        return targetCode
      }
      output.push(`${targetCode};`)
    },
    ConstructorCall(c) {
      return `new ${gen(c.callee)}(${c.args.map(gen).join(", ")})`
    },
  }

  gen(program)
  return output.join("\n")
}