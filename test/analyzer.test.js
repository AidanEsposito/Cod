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
  ["type array", "number[] x = [1, 2, 3]"],
  //["type array with type and index", "number[] x = [1, 2, 3] cast: x[1]"],
  ["increment with variable", "number x = 10 x++"],
  ["decrement with variable", "number x = 10 x--"],
  ["increment and decrement", "number x = 10 x-- x++"],
  ["type declaration", 'number x = 1 boolean y = hooked string z = "hello"'],
  ["existing type identifier", "number x = 1 number y = x"],
  ["function call", "ocean number x() { cast: 1 } cast: x()"],
  ["try statement", "pitch { cast: 1 }"],
  ["try statement with catch", "pitch { cast: 1 } catch (Fail Exception) { cast: 2 }"],
  //["catch statement", "catch (Fail Exception) { cast: 2 }"],
  ["catch empty block", "pitch { cast: 1 } catch (Fail Exception) { }"],
  ["public function declaration", "ocean number x() { cast: 1 }"],
  ["public function declaration with return", "ocean number x() { reel 1 }"],
  ["public function declaration with argument", "ocean number x(number y) { cast: y }"],
  [
    "public function declaration with multiple arguments",
    "ocean number x(number y, number z) { cast: y + z }",
  ],
  [
    "public function declaration with multiple arguments and return",
    "ocean number x(number y, number z) { reel y + z }",
  ],
  ["private function declaration", "lake number x() { cast: 1 }"],
  ["private function declaration with return", "lake number x() { reel 1 }"],
  ["private function declaration with argument", "lake number x(number y) { cast: y }"],
  [
    "private function declaration with multiple arguments",
    "lake number x(number y, number z) { cast: y + z }",
  ],
  [
    "private function declaration with multiple arguments and return",
    "lake number x(number y, number z) { reel y + z }",
  ],
  ["long return", "boolean test(){ reel hooked}"],
  ["short return", "boolean test(){ reel hooked}"],
  ["return in nested if", "boolean f(){ if hooked{ reel hooked}}"],
  [
    "return in nested if else",
    "boolean f(){ if hooked{ reel hooked} else { reel unhooked}}",
  ],
  ["return in nested function", "boolean f(){ boolean g(){ reel hooked}}"],
  ["void function", "lost test() { reel }"],
  ["break in nested if", "tide unhooked{ if hooked{ snap}} "],
  ["type declaration with initialization", "number x = 42"],
  ["type declaration without initialization", "number x"],
  ["public type declaration", "ocean number x = 1"],
  ["public type declaration without initialization", "ocean number x"],
  ["private type declaration", "lake number x = 1"],
  ["private type declaration without initialization", "lake number x"],
  ["short if", "if hooked { cast: 1}"],
  ["long if", "if hooked { cast: 1} else {cast: 3}"],
  ["elsif", "if hooked {cast: 1} else if hooked { cast: 0} else {cast: 3}"],
  ["logical operator if", "if hooked && hooked { cast: 1}"],
  ["correct argument count in function call", "ocean number x(){ cast: 1}"],
  ["for in range", "stream i in 1 ..< 10{ cast: 0 }"],
  ["for in collection", "stream x in [1, 2, 3]{ cast: 0 }"],
  ["while", "tide hooked{ cast: 1} "],
  ["||", "boolean hello = unhooked cast: hooked || unhooked || hello"],
  ["&&", "cast: (hooked && 1< 2 && unhooked &&!hooked)"],
  ["arithmetic", "number x = 1 cast: (2*3+5**-3/2-5%8)"],
  ["variables", "number x = 1 cast: x + 2"],
  ["assigned functions", "ocean number x(){ number g = 2 number f = g}"],
  ["multi param functions", "ocean number hello (number x, number y){ cast: 1}"],
  ["class declaration", "school x: cast: x"],
  ["empty class declaration", "school x: "],
  ["nested class declaration", "school x: school y: cast: x"],
  ["public classes", "ocean school x: cast: x"],
  ["private classes", "lake school x: ocean school y: cast: x"],
  ["outer variable", "number x = 1 tide unhooked { cast: x }"],
  ["short return", "lost test() { reel }"],
  ["struct fields", "boat x { number y }"],
]

// // Programs that are syntactically correct but have semantic errors
const semanticErrors = [
  [
    "duplicate parameter names",
    "number hello(number x, boolean x){}",
    /Identifier x already declared/,
  ],
  ["non-number increment", "boolean x = unhooked x++", /Expected a number/],
  ["non-number decrement", "boolean x = hooked x--", /Expected a number/],
  ["undeclared id", "cast: x", /Identifier x not declared/],
  ["redeclared id", "number x = 1 number x = 1", /Identifier x already declared/],
  ["identifier is not a type", "number x = 1 x y = 2", /Type expected/],
  ["must be assignable", "number a = hooked", /Cannot assign a boolean to a number/],
  ["non existing type identifier", "number x = y", /Identifier y not declared/],
  [
    "redeclared public id",
    "ocean number z = 1 ocean number z = 1",
    /Identifier z already declared/,
  ],
  [
    "redeclared private id",
    "lake number x = 1 lake number x = 1",
    /Identifier x already declared/,
  ],
  ["break outside loop", "snap", /Break can only appear in a loop/],
  ["continue outside loop", "flow", /Continue can only appear in a loop/],
  [
    "break inside function",
    "tide hooked{ boolean f(){ snap}}",
    /Break can only appear in a loop/,
  ],
  ["return outside function", "reel", /Return can only appear in a function/],

  [
    "return value from void function",
    "lost hello(){ reel 1}",
    /Cannot return a value from this function/,
  ],

  [
    "return nothing from non-void",
    "number hello(){ reel }",
    /Something should be returned/,
  ], //possibly fails syntax checks beforehand
  [
    "classes can't be made inside of functions",
    "ocean number x(){ ocean school y: cast: x }",
    /Classes can't be made inside of functions/,
  ],
  // [
  //   "public classes can't be made inside of private classes",
  //   "lake school x: ocean school y: cast: x",
  //   /Public classes can't be made inside of Private classes/,
  // ],

  [
    "return type mismatch",
    " number test() { reel unhooked }",
    /Cannot assign a boolean to a number/,
  ],
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
})
