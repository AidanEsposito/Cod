import assert from "node:assert/strict"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"
import { program, variableDeclaration, variable, binary, floatType } from "../src/core.js"

// Programs that are semantically correct
const semanticChecks = [
  ["simple print", "cast: 1"],
  ["complex print", "cast: 1 + 2 * 3 / 4 - 5 % 6 ** 7"],
  ["variable declarations", "int x = 1 land y = unhooked"],
  ["complex variable declarations", "int x = 1 land y = 2 cast: x + y"],
  ["variable print", "land x = 1 cast: x"],
  ["type array", "int x = [1, 2, 3]"],
  ["increment and decrement", "land x = 10 x-- x++"],
  ["increment and decrement", "land x = 10; x--; x++;"],
  ["type declaration", "int x = 1, boolean y = hooked, string z = 'hello'"],
  ["short return", "string test(){ reel }"],
  ["long return", "boolean test(){ reel hooked}"],
  //FIX RETURN IN OHM!
  ["return in nested if", "boolean f(){ if hooked{ reel}}"],
  ["break in nested if", "tide unhooked{ if hooked{ snap}} "],
  ["short if", "if hooked { cast: 1}"],
  ["long if", "if hooked { cast: 1} else {cast: 3}"],
  ["elsif", "if hooked {cast: 1} else if hooked { cast: 0} else {cast: 3}"],

  ["for in range", "stream i in x < 10{ cast: 0 }"],
  ["while", "tide hooked{ cast: 1} "],
  ["||", "cast: hooked || unhooked || 1 || hello"],
  ["&&", "cast: (hooked && 1< 2 && unhooked &&!hooked)"],
<<<<<<< HEAD
  ["relations", 'cast:  1<= 2 && "x"> "y" &&  3.5 <1.2'],
=======
  //   ["bit ops", "print((1&2)|(9^3));"],
  ["relations", 'cast:  1<= 2 && "x"> "y" &&  3.5 <1.2'],
  //   ["ok to == arrays", "print([1]==[5,8]);"],
  //   ["ok to != arrays", "print([1]!=[5,8]);"],
  //   ["shifts", "print(1<<3<<5<<8>>2>>0);"],
>>>>>>> 06adef368c1c0d55c0ef9d6574df8b85f909a37e
  ["arithmetic", "land x = 1 cast: (2*3+5**-3/2-5%8)"],
  ["variables", "land x = [[[[1]]]] cast: x + 2"],
  ["assigned functions", "ocean int f(){ let g = f let f = g}"],
  ["multi param functions", "ocean int hello (int x, int y){ cast: 1}"],
  ["outer variable", "land x = 1 tide unhooked { cast: x }"],
]

// // Programs that are syntactically correct but have semantic errors
const semanticErrors = [
  ["non-distinct fields", "int hello(int x, boolean x){}", /Fields must be distinct/],
  ["non-int increment", "boolean x = unhooked x++", /Expected an integer/],
  ["non-int decrement", 'land x = hooked x--', /Expected an integer/],
  ["undeclared id", "cast: x", /Identifier x not declared/],
  ["redeclared id", "land x = 1 land x = 1", /Identifier x already declared/],
<<<<<<< HEAD
=======
    //   ["assign bad type", "let x=1;x=true;", /Cannot assign a boolean to a int/],
>>>>>>> 06adef368c1c0d55c0ef9d6574df8b85f909a37e
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
    /Cannot return a value/,
  ],

  ["return nothing from non-void", "int f(){ return }", /should be returned/], //possibly fails syntax checks beforehand
  [
    "classes can't be made inside of functions",
    "ocean int x(){ ocean school tag: cast: x }",
    /Classes can't be made inside of functions/,
  ],
  [
    "public classes can't be made inside of private classes", 
    "lake school x: ocean school y: cast: x", 
    /Public classes can't be made in Private classes/,
  ],

  ["return type mismatch", " int test() { reel unhooked }", /boolean to a int/],
  ["non-boolean short if test", "if 1 {}", /Expected hooked or unhooked (a boolean)/],
  ["non-boolean if test", " if 1 {} else {}", /Expected a boolean/],
  ["non-boolean while test", "tide 1 {}", /Expected a boolean/],
  ["bad types for ||", "cast: unhooked || 1", /Expected a boolean/],
  ["bad types for &&", "cast: unhooked && 1", /Expected a boolean/],
  ["bad types for ==", "cast: unhooked ==1", /Operands do not have the same type/],
  ["bad types for !=", "cast: unhooked != 1", /Operands do not have the same type/],
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
<<<<<<< HEAD
  //FUNCTION CALL NEEDS WORK!!!
  ["call of uncallable", "land x = 1 cast: x()", /Call of non-function/],
=======

  //   ["non-integer index", "let a=[1];print(a[false]);", /Expected an integer/],
  // ["no such field", "struct S{} let x=S(); print(x.y);", /No such field/],
  //   ["diff type array elements", "print([3,3.0]);", /Not all elements have the same type/],
  //   ["shadowing", "let x = 1;\nwhile true {let x = 1;}", /Identifier x already declared/],

  //FUNCTION CALL NEEDS WORK!!!

  ["call of uncallable", "land x = 1 cast: x()", /Call of non-function/],


  //   [
  //     "Too many args",
  //     "function f(x: int) {}\nf(1,2);",
  //     /1 argument\(s\) required but 2 passed/,
  //   ],


  //fix function call!!!!

    // [
    //   "Too few args",
    //   "function f(x: int) {}\nf();",
    //   /1 argument\(s\) required but 0 passed/,
    // ],




  //   [
  //     "Parameter type mismatch",
  //     "function f(x: int) {}\nf(false);",
  //     /Cannot assign a boolean to a int/,
  //   ],
  //   [
  //     "function type mismatch",
  //     `function f(x: int, y: (boolean)->void): int { return 1; }
  //      function g(z: boolean): int { return 5; }
  //      f(2, g);`,
  //     /Cannot assign a \(boolean\)->int to a \(boolean\)->void/,
  //   ],
>>>>>>> 06adef368c1c0d55c0ef9d6574df8b85f909a37e
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
