import assert from "node:assert/strict"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"
import {
  program,
  variableDeclaration,
  variable,
  binary,
  numberType,
} from "../src/core.js"

// Programs that are semantically correct
const semanticChecks = [
  ["simple print", "cast: 1"],
  ["complex print", "cast: 1 + 2 * 3 / 4 - 5 % 6 ** 7"],
  ["variable declarations", "number x = 1 boolean y = unhooked"],
  ["complex variable declarations", "number x = 1 number y = 2 cast: x + y"],
  ["variable print", "number x = 1 cast: x"],
  ["type array", "number x = [1, 2, 3]"],
  ["increment and decrement", "number x = 10 x-- x++"],
  ["type declaration", 'number x = 1 boolean y = hooked string z = "hello"'],
  ["short return", "string test(){ reel }"],
  ["long return", "boolean test(){ reel hooked}"],
  //FIX RETURN IN OHM!
  ["return in nested if", "boolean f(){ if hooked{ reel}}"],
  ["break in nested if", "tide unhooked{ if hooked{ snap}} "],
  ["short if", "if hooked { cast: 1}"],
  ["long if", "if hooked { cast: 1} else {cast: 3}"],
  ["elsif", "if hooked {cast: 1} else if hooked { cast: 0} else {cast: 3}"],

  ["for in range", "stream i in [1,2,3] < 10{ cast: 0 }"],
  ["while", "tide hooked{ cast: 1} "],
  ["||", "boolean hello = unhooked cast: hooked || unhooked || hello"],
  ["&&", "cast: (hooked && 1< 2 && unhooked &&!hooked)"],
  ["arithmetic", "number x = 1 cast: (2*3+5**-3/2-5%8)"],
  ["variables", "land x = [[[[1]]]] cast: x + 2"],
  ["assigned functions", "ocean number f(){ number g = f number f = g}"],
  ["multi param functions", "ocean number hello (number x, number y){ cast: 1}"],
  ["outer variable", "number x = 1 tide unhooked { cast: x }"],
]

// // Programs that are syntactically correct but have semantic errors
const semanticErrors = [
  [
    "non-distinct fields",
    "number hello(number x, boolean x){}",
    /Fields must be distinct/,
  ],
  ["non-number increment", "boolean x = unhooked x++", /Expected a number/],
  ["non-number decrement", "boolean x = hooked x--", /Expected a number/],
  ["undeclared id", "cast: x", /Identifier x not declared/],
  ["redeclared id", "number x = 1 number x = 1", /Identifier x already declared/],
  ["break outside loop", "snap", /Break can only appear in a loop/],
  ["continue outside loop", "flow", /Continue can only appear in a loop/],
  [
    "break inside function",
    "tide hooked{ boolean f(){ snap}}",
    /Break can only appear in a loop/,
  ],
  ["return outside function", "reel", /Return can only appear in a function/],

  ["throws on return value from void function", "lost hello(){ reel 1}", /Cannot return a value from this function/],

  ["throws on return nothing from non-void", "number hello(){ reel }", /Something should be returned/], //possibly fails syntax checks beforehand
  [
    "classes can't be made inside of functions",
    "ocean number x(){ ocean school y: cast: x }",
    /Classes can't be made inside of functions/,
  ],
  [
    "public classes can't be made inside of private classes",
    "lake school x: ocean school y: cast: x",
    /Public classes can't be made in Private classes/,
  ],

  ["return type mismatch", " number test() { reel unhooked }", /Cannot assign a boolean to a number/],
  ["non-boolean short if test", "if 1 {}", /Expected a boolean/],
  ["non-boolean if test", " if 1 {} else {}", /Expected a boolean/],
  ["non-boolean while test", "tide 1 {}", /Expected a boolean/],
  ["bad types for ||", "cast: unhooked || 1", /Expected a boolean/],
  ["bad types for &&", "cast: unhooked && 1", /Expected a boolean/],
  ["bad types for +", "cast: unhooked + 1 ", /Expected a number or string/],
  ["bad types for -", "cast: unhooked - 1", /Expected a number/],
  ["bad types for *", "cast: unhooked * 1", /Expected a number/],
  ["bad types for /", "cast: unhooked / 1", /Expected a number/],
  ["bad types for %", "cast: unhooked % 1", /Expected a number/],
  ["bad types for **", "cast: unhooked ** 1", /Expected a number/],
  ["bad types for <", "cast: unhooked < 1", /Expected a number or string/],
  ["bad types for <=", "cast: unhooked <= 1", /Expected a number or string/],
  ["bad types for >", "cast: unhooked > 1", /Expected a number or string/],
  ["bad types for >=", "cast: unhooked >= 1", /Expected a number or string/],
  ["bad types for ==", "cast: unhooked == 1", /not have the same type/],
  ["bad types for !=", "cast: unhooked != 1", /not have the same type/],
  ["bad types for negation", "cast: -hooked", /Expected a number/],
  ["bad types for not", 'cast: !"hello"', /Expected a boolean/],
  ["call of uncallable", "number x = 1 cast: x()", /Call of non-function/],
]

describe("The analyzer", () => {
  for (const [scenario, source] of semanticChecks) {
    it(`recognizes ${scenario}`, () => {
      assert.ok(analyze(parse(source)))
    })
  }
  for (const [scenario, source, errorMessagePattern] of semanticErrors) {
    it(`throws on ${scenario}`, () => {
      assert.throws(() => analyze(parse(source)), errorMessagePattern)
    })
  }
  // it("produces the expected representation for a trivial program", () => {
  //   assert.deepEqual(
  //     analyze(parse("let x = π + 2.2;")),
  //     program([
  //       variableDeclaration(
  //         variable("x", false, floatType),
  //         binary("+", variable("π", true, floatType), 2.2, floatType)
  //       ),
  //     ])
  //   )
  // })
})
