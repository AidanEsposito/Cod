import assert from "node:assert/strict"
import optimize from "../src/optimizer.js"
import * as core from "../src/core.js"

// Make some test cases easier to read
const x = core.variable("x", false, core.numberType)
const a = core.variable("a", false, core.arrayType(core.numberType))
const xpp = core.incrementStatement(x)
const xmm = core.decrementStatement(x)
const return1p1 = core.returnStatement(core.binary("+", 1, 1, core.numberType))
const return2 = core.returnStatement(2)
const returnX = core.returnStatement(x)
const onePlusTwo = core.binary("+", 1, 2, core.numberType)
const identity = Object.assign(core.fun("id", core.anyType), { body: returnX })
const voidInt = core.functionType([], core.numberType)
const numberFun = body => core.functionDeclaration("f", core.fun("f", voidInt), [], [body])
const or = (...d) => d.reduce((x, y) => core.binary("||", x, y))
const and = (...c) => c.reduce((x, y) => core.binary("&&", x, y))
const less = (x, y) => core.binary("<", x, y)
const eq = (x, y) => core.binary("==", x, y)
const times = (x, y) => core.binary("*", x, y)
const neg = x => core.unary("-", x)
const array = (...elements) => core.arrayExpression(elements)
const unwrapElse = (o, e) => core.binary("??", o, e)
const some = x => core.unary("some", x)
const program = core.program

const tests = [
  ["folds +", core.binary("+", 5, 8,), 13],
  ["folds -", core.binary("-", 5n, 8n), -3n],
  ["folds *", core.binary("*", 5, 8), 40],
  ["folds /", core.binary("/", 5, 8), 0.625],
  ["folds **", core.binary("**", 5, 8), 390625],
  ["folds <", core.binary("<", 5, 8), true],
  ["folds <=", core.binary("<=", 5, 8), true],
  ["folds ==", core.binary("==", 5, 8), false],
  ["folds !=", core.binary("!=", 5, 8), true],
  ["folds >=", core.binary(">=", 5, 8), false],
  ["folds >", core.binary(">", 5, 8), false],
  ["optimizes +0", core.binary("+", x, 0), x],
  ["optimizes -0", core.binary("-", x, 0), x],
  ["optimizes *1", core.binary("*", x, 1), x],
  ["optimizes /1", core.binary("/", x, 1), x],
  ["optimizes *0", core.binary("*", x, 0), 0],
  ["optimizes 0*", core.binary("*", 0, x), 0],
  ["optimizes 0/", core.binary("/", 0, x), 0],
  ["optimizes 0+", core.binary("+", 0, x), x],
  ["optimizes 0-", core.binary("-", 0, x), neg(x)],
  ["optimizes 1*", core.binary("*", 1, x), x],
  ["folds negation", core.unary("-", 8), -8],
  ["optimizes 1**", core.binary("**", 1, x), 1],
  ["optimizes **0", core.binary("**", x, 0), 1],
  ["removes left false from ||", or(false, less(x, 1)), less(x, 1)],
  ["removes right false from ||", or(less(x, 1), false), less(x, 1)],
  ["removes left true from &&", and(true, less(x, 1)), less(x, 1)],
  ["removes right true from &&", and(less(x, 1), true), less(x, 1)],
  ["removes left true from &&", and(true, less(x, 1)), less(x, 1)],
  ["type is preserved", core.variable("x", false, core.numberType), x],
  ["type is preserved in binary", core.binary("+", x, 1, core.numberType), core.binary("+", x, 1, core.numberType)],
  ["optimizes if-true", core.ifStatement(true, [xpp], []), [xpp]],
  ["optimizes if-false", core.ifStatement(false, [], [xpp]), [xpp]],
  ["optimizes short-if-true", core.shortIfStatement(true, [xmm]), [xmm]],
  ["optimizes short-if-false", core.shortIfStatement(false, [xpp]), []],
  ["optimizes while-false", program([core.whileStatement(false, [xpp])]), program([])],
  ["optimizes for-range", core.forRangeStatement(x, 5, "...", 3, [xpp]), []],
  ["applies if-false after folding", core.shortIfStatement(eq(1, 1), [xpp]), [xpp]],
  ["optimizes in functions", program([numberFun(return1p1)]), program([numberFun(return2)])],
  ["optimizes in array literals", array(0, onePlusTwo, 9), array(0, 3, 9)],
]

describe("The optimizer", () => {
  for (const [scenario, before, after] of tests) {
    it(`${scenario}`, () => {
      assert.deepEqual(optimize(before), after)
    })
  }
})