import * as core from "./core.js"

export default function optimize(node) {
  return optimizers?.[node.kind]?.(node) ?? node
}

const optimizers = {
  program(p) {
    p.statements = p.statements.flatMap(optimize)
    return p
  },
  functionDeclaration(d) {
    d.fun = optimize(d.fun)
    if (d.body) d.body = d.body.flatMap(optimize)
    return d
  },
  arrayExpression(e) {
    e.elements = e.elements.map(optimize)
    return e
  },
  variableDeclaration(d) {
    d.variable = optimize(d.variable)
    d.initializer = optimize(d.initializer)
    return d
  },
   ifStatement(s) {
    s.test = optimize(s.test)
    s.consequent = s.consequent.flatMap(optimize)
    s.alternate = s.alternate.flatMap(optimize)
    if (s.test.constructor === Boolean) {
      return s.test ? s.consequent : s.alternate
    }
    return s
  },
  shortIfStatement(s) {
    s.test = optimize(s.test)
    s.consequent = s.consequent.flatMap(optimize)
    if (s.test.constructor === Boolean) {
      return s.test ? s.consequent : []
    }
    return s
  },
  whileStatement(s) {
    s.test = optimize(s.test)
    if (s.test === false) {
      return []
    }
    s.body = s.body.flatMap(optimize)
    return s
  },
  forRangeStatement(s) {
    s.iterator = optimize(s.iterator)
    s.low = optimize(s.low)
    s.op = optimize(s.op)
    s.high = optimize(s.high)
    s.body = s.body.flatMap(optimize)
    if (s.low.constructor === Number) {
      if (s.high.constructor === Number) {
        if (s.low > s.high) {
          return []
        }
      }
    }
    return s
  },
  forStatement(s) {
    s.iterator = optimize(s.iterator)
    s.collection = optimize(s.collection)
    s.body = s.body.flatMap(optimize)
    return s
  },
   returnStatement(s) {
    s.expression = optimize(s.expression)
    return s
  },
  incrementStatement(s) {
    s.operand = optimize(s.operand)
    return s
  },
  decrementStatement(s) {
    s.operand = optimize(s.operand)
    return s
  },
  breakStatement(s) {
    return s
  },
  binaryExpression(e) {
    e.op = optimize(e.op)
    e.left = optimize(e.left)
    e.right = optimize(e.right)
    if (e.op === "&&") {
      // Optimize boolean constants in && and ||
      if (e.left === true) return e.right
      else if (e.right === true) return e.left
    } else if (e.op === "||") {
      if (e.left === false) return e.right
      else if (e.right === false) return e.left
    } else if ([Number, BigInt].includes(e.left.constructor)) {
      // Numeric constant folding when left operand is constant
      if ([Number, BigInt].includes(e.right.constructor)) {
        if (e.op === "+") return e.left + e.right
        else if (e.op === "-") return e.left - e.right
        else if (e.op === "*") return e.left * e.right
        else if (e.op === "/") return e.left / e.right
        else if (e.op === "**") return e.left ** e.right
        else if (e.op === "<") return e.left < e.right
        else if (e.op === "<=") return e.left <= e.right
        else if (e.op === "==") return e.left === e.right
        else if (e.op === "!=") return e.left !== e.right
        else if (e.op === ">=") return e.left >= e.right
        else if (e.op === ">") return e.left > e.right
      } else if (e.left === 0 && e.op === "+") return e.right
      else if (e.left === 1 && e.op === "*") return e.right
      else if (e.left === 0 && e.op === "-") return core.unary("-", e.right)
      else if (e.left === 1 && e.op === "**") return 1
      else if (e.left === 0 && ["*", "/"].includes(e.op)) return 0
    } else if ([Number, BigInt].includes(e.right.constructor)) {
      // Numeric constant folding when right operand is constant
      if (["+", "-"].includes(e.op) && e.right === 0) return e.left
      else if (["*", "/"].includes(e.op) && e.right === 1) return e.left
      else if (e.op === "*" && e.right === 0) return 0
      else if (e.op === "**" && e.right === 0) return 1
    }
    return e
  },
    unaryExpression(e) {
    e.operand = optimize(e.operand)
    return -e.operand
  },
  functionCall(c) {
    c.callee = optimize(c.callee)
    c.args = c.args.map(optimize)
    return c
  },
}