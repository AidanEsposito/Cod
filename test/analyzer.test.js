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
  //   ["assign arrays", "let a = [int]();let b=[1];a=b;b=a;"],
  //   ["assign to array element", "const a = [1,2,3]; a[1]=100;"],
  //   ["initialize with empty optional", "let a = no int;"],
  ["short return", "string test(){ reel }"],
  ["long return", "boolean test(){ reel hooked}"],
  //   ["assign optionals", "let a = no int;let b=some 1;a=b;b=a;"],

  //FIX RETURN IN OHM!

  ["return in nested if", "boolean f(){ if hooked{ reel}}"],
  ["break in nested if", "tide unhooked{ if hooked{ snap}} "],
  ["long if", "if hooked { cast: 1} else {cast: 3}"],
  ["elsif", "if hooked {cast: 1} else if hooked { cast: 0} else {cast: 3}"],
  ["for in range", "stream i in x < 10{ cast: 0 }"],
  ["while", "tide hooked{ cast: 1} "],
  //   ["conditionals with ints", "print(true ? 8 : 5);"],
  //   ["conditionals with floats", "print(1<2 ? 8.0 : -5.22);"],
  //   ["conditionals with strings", 'print(1<2 ? "x" : "y");'],
  //   ["??", "print(some 5 ?? 0);"],
  //   ["nested ??", "print(some 5 ?? 8 ?? 0);"],
  ["||", "cast: hooked || unhooked || 1 || hello"],
  ["&&", "cast: (hooked && 1< 2 && unhooked &&!hooked)"],
  //   ["bit ops", "print((1&2)|(9^3));"],
  //   ["relations", 'print(1<=2 && "x">"y" && 3.5<1.2);'],
  //   ["ok to == arrays", "print([1]==[5,8]);"],
  //   ["ok to != arrays", "print([1]!=[5,8]);"],
  //   ["shifts", "print(1<<3<<5<<8>>2>>0);"],
  ["arithmetic", "land x = 1 cast: (2*3+5**-3/2-5%8)"],
  //   ["array length", "print(#[1,2,3]);"],
  //   ["optional types", "let x = no int; x = some 100;"],
  //   ["random with array literals, ints", "print(random [1,2,3]);"],
  //   ["random with array literals, strings", 'print(random ["a", "b"]);'],
  //   ["random on array variables", "let a=[true, false];print(random a);"],
  ["variables", "land x = [[[[1]]]] cast: x + 2"],
  //   ["pseudo recursive struct", "struct S {z: S?} let x = S(no S);"],
  //   ["nested structs", "struct T{y:int} struct S{z: T} let x=S(T(1)); print(x.z.y);"],
  //   ["member exp", "struct S {x: int} let y = S(1);print(y.x);"],
  //   ["optional member exp", "struct S {x: int} let y = some S(1);print(y?.x);"],
  //   ["subscript exp", "let a=[1,2];print(a[0]);"],
  //   ["array of struct", "struct S{} let x=[S(), S()];"],
  //   ["struct of arrays and opts", "struct S{x: [int] y: string??}"],
  ["assigned functions", "ocean int f(){ let g = f let f = g}"],
  ["multi param functions", "ocean int hello (int x, int y){ cast: 1}"],
  //   ["type equivalence of nested arrays", "function f(x: [[int]]) {} print(f([[1],[2]]));"],
  //   [
  //     "call of assigned function in expression",
  //     `function f(x: int, y: boolean): int {}
  //     let g = f;
  //     print(g(1, true));
  //     f = g; // Type check here`,
  //   ],
  //   [
  //     "pass a function to a function",
  //     `function f(x: int, y: (boolean)->void): int { return 1; }
  //      function g(z: boolean) {}
  //      f(2, g);`,
  //   ],
  //   [
  //     "function return types",
  //     `function square(x: int): int { return x * x; }
  //      function compose(): (int)->int { return square; }`,
  //   ],
  //   ["function assign", "function f() {} let g = f; let h = [g, f]; print(h[0]());"],
  //   ["struct parameters", "struct S {} function f(x: S) {}"],
  //   ["array parameters", "function f(x: [int?]) {}"],
  //   ["optional parameters", "function f(x: [int], y: string?) {}"],
  //   ["empty optional types", "print(no [int]); print(no string);"],
  //   ["types in function type", "function f(g: (int?, float)->string) {}"],
  //   ["voids in fn type", "function f(g: (void)->void) {}"],
  ["outer variable", "land x = 1 tide unhooked { cast: x }"],
]

// // Programs that are syntactically correct but have semantic errors
const semanticErrors = [
  //   ["non-distinct fields", "struct S {x: boolean x: int}", /Fields must be distinct/],
["non-int increment", "boolean x = unhooked x++", /an integer/],
["non-int decrement", 'land x = true x++', /an integer/],
["undeclared id", "cast: x", /Identifier x not declared/],
["redeclared id", "land x = 1 land x = 1", /Identifier x already declared/],
  //   ["assign bad type", "let x=1;x=true;", /Cannot assign a boolean to a int/],
  //   ["assign bad array type", "let x=1;x=[true];", /Cannot assign a \[boolean\] to a int/],
["break outside loop", "snap", /Break can only appear in a loop/],
  //   [
  //     "break inside function",
  //     "while true {function f() {break;}}",
  //     /Break can only appear in a loop/,
  //   ],
["return outside function", "reel", /Return can only appear in a function/],
  //   [
  //     "return value from void function",
  //     "function f() {return 1;}",
  //     /Cannot return a value/,
  //   ],
  //   ["return nothing from non-void", "function f(): int {return;}", /should be returned/],
  [
    "classes can't be made inside of functions",
    "ocean int x(){ ocean school tag: cast: x }",
    /Classes can't be made inside of functions/,
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
  //   ["bad types for length", "print(#false);", /Expected an array/],
  ["bad types for not", 'cast: !"hello"', /Expected a boolean/],
  //   ["bad types for random", "print(random 3);", /Expected an array/],
  //   ["non-integer index", "let a=[1];print(a[false]);", /Expected an integer/],
  // ["no such field", "struct S{} let x=S(); print(x.y);", /No such field/],
  //   ["diff type array elements", "print([3,3.0]);", /Not all elements have the same type/],
  //   ["shadowing", "let x = 1;\nwhile true {let x = 1;}", /Identifier x already declared/],
  //   ["call of uncallable", "let x = 1;\nprint(x());", /Call of non-function/],
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
  //   ["bad param type in fn assign", "function f(x: int) {} function g(y: float) {} f = g;"],
  //   [
  //     "bad return type in fn assign",
  //     'function f(x: int): int {return 1;} function g(y: int): string {return "uh-oh";} f = g;',
  //     /Cannot assign a \(int\)->string to a \(int\)->int/,
  //   ],
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
