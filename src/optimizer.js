// export default function optimize(node) {
//   return node
// }

// The optimizer module exports a single function, optimize(node), to perform
// machine-independent optimizations on the analyzed semantic representation.
//
// The only optimizations supported here are:
//
//   - assignments to self (x = x) turn into no-ops
//   - constant folding
//   - some strength reductions (+0, -0, *0, *1, etc.)
//   - turn references to built-ins true and false to be literals
//   - remove all disjuncts in || list after literal true
//   - remove all conjuncts in && list after literal false
//   - while-false becomes a no-op
//   - repeat-0 is a no-op
//   - for-loop over empty array is a no-op
//   - for-loop with low > high is a no-op
//   - if-true and if-false reduce to only the taken arm
//
// The optimizer also replaces token references with their actual values,
// since the original token line and column numbers are no longer needed.
// This simplifies code generation.

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
  typeDeclaration(d) {
    d.type = optimize(d.type)
    return d
  },
  ifStatement(s) {
    s.test = optimize(s.test)
    s.consequent = s.consequent.flatMap(optimize)
    if (s.alternate?.kind?.endsWith?.("ifStatement")) {
      s.alternate = optimize(s.alternate)
    } else {
      s.alternate = s.alternate.flatMap(optimize)
    }
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
      // while false is a no-op
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
    if (s.collection?.kind === "EmptyArray") {
      return []
    }
    return s
  },
   returnStatement(s) {
    s.expression = optimize(s.expression)
    return s
  },
  shortReturnStatement(s) {
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
  binary(e) {
    console.log(e)
    e.op = optimize(e.op)
    console.log(e.op)
    e.left = optimize(e.left)
    console.log(e.left)
    e.right = optimize(e.right)
    console.log(e.right)
    if (e.op === "??") {
      // Coalesce Empty Optional Unwraps
      if (e.left?.kind === "EmptyOptional") {
        return e.right
      }
    } else if (e.op === "&&") {
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
  unary(e) {
    e.op = optimize(e.op)
    e.operand = optimize(e.operand)
    if (e.operand.constructor === Number) {
      if (e.op === "-") {
        return -e.operand
      }
    }
    return e
  },
  functionCall(c) {
    c.callee = optimize(c.callee)
    c.args = c.args.map(optimize)
    return c
  },
}