import assert from "node:assert/strict"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"
import optimize from "../src/optimizer.js"
import generate from "../src/generator.js"

function dedent(s) {
  return `${s}`.replace(/(?<=\n)\s+/g, "").trim()
}

const fixtures = [
  {
    name: "vardec test",
    source: `number x = 3 * 7`,
    expected: dedent`
      let x_1 = (3 * 7);
    `,
  },
  {
    name: "small",
    source: `
      number x = 3 * 7
      x++
      x--
      boolean y = hooked
      cast: y && y || unhooked || (x*2) != 5
    `,
    expected: dedent`
      let x_1 = 21;
      x_1++;
      x_1--;
      let y_2 = true;
      console.log(((y_2 && y_2) || ((x_1 * 2) !== 5)));
    `,
  },
  {
    name: "short if",
    source: `
      number x = 0
      if x == 0 { cast: "1" }
    `,
    expected: dedent`
      let x_1 = 0;
      if ((x_1 === 0)) {
        console.log("1");
      }
    `,
  },
  {
    name: "if else",
    source: `
      number x = 0
      if x == 0 { cast: 1 } else { cast: 2 }
    `,
    expected: dedent`
      let x_1 = 0;
      if ((x_1 === 0)) {
        console.log(1);
      } else {
        console.log(2);
      }
    `,
  },
  {
    name: "if else empty",
    source: `number x = 0 if x == 0 { } else { }
    `,
    expected: dedent`
      let x_1 = 0;
      if ((x_1 === 0)) {
      } else {
      }
    `,
  },
  {
    name: "if else if",
    source: `
      number x = 0
      if x == 0 { cast: 1 } else if x == 2 { cast: 3 }
    `,
    expected: dedent`
      let x_1 = 0;
      if ((x_1 === 0)) {
        console.log(1);
      } else {
      if ((x_1 === 2)) {
          console.log(3);
      }
      }
    `,
  },
  {
    name: "if else if else",
    source: `
      number x = 0
      if x == 0 { cast: 1 } else if x == 2 { cast: 3 } else { cast: 4 }
    `,
    expected: dedent`
      let x_1 = 0;
      if ((x_1 === 0)) {
        console.log(1);
      } else {
      if ((x_1 === 2)) {
          console.log(3);
        } else {
          console.log(4);
        }
        }
    `,
  },
  {
    name: "if else with alternate if",
    source: `
      number x = 0
      if x == 0 { cast: 1 } else { if x == 2 { cast: 3 } }
    `,
    expected: dedent`
      let x_1 = 0;
      if ((x_1 === 0)) {
        console.log(1);
      } else {
        if ((x_1 === 2)) {
          console.log(3);
        }
      }
    `,
  },
  {
    name: "while",
    source: `
      number x = 0
      tide x < 5 {
        number y = 0
        tide y < 5 {
          cast: "hello"
          y++
          if y == 5 { snap }
        }
        x++
      }
    `,
    expected: dedent`
      let x_1 = 0;
      while ((x_1 < 5)) {
        let y_2 = 0;
        while ((y_2 < 5)) {
          console.log("hello");
          y_2++;
          if ((y_2 === 5)) {
            break;
          }
        }
        x_1++;
      }
    `,
  },
  {
    name: "continue and break",
    source: `
      number x = 0
      tide x < 5 {
        x++
        if x == 3 { snap }
        flow
      }
    `,
    expected: dedent`
      let x_1 = 0;
      while ((x_1 < 5)) {
        x_1++;
        if ((x_1 === 3)) {
          break;
        }
        continue;
      }
    `,
  },

  // 40, 43

  {
    name: "functions",
    source: `
      number z = 0.5
      number f(number x, boolean y) {
        cast: "i'm a working function"
        reel 0
      }
      ocean boolean g(){
        reel unhooked
      }
    `,
    expected: dedent`
      let z_1 = 0.5;
      function f_2(x_3, y_4) {
        console.log("i'm a working function");
        return 0;
      }
      function g_5() {
        return false;
      }
    `,
  },
  {
    name: "array types",
    source: `
      number[] a = [1, 2, 3]
      boolean[] b = [hooked, unhooked, hooked]
      string[] c = ["hello", "world"]
    `,
    expected: dedent`
      let a_1 = [1, 2, 3];
      let b_2 = [true, false, true];
      let c_3 = ["hello", "world"];
    `,
  },
  {
    name: "unary operators",
    source: `
      number x = 3
      cast: -x
      cast: !hooked
    `,
    expected: dedent`
      let x_1 = 3;
      console.log(-(x_1));
      console.log(!(true));
    `,
  },
  {
    name: "for loops",
    source: `
      stream i in 1..< 50 {
        cast: "working"
      }
      stream j in [10, 20, 30] {
        cast: "working"
      }
    `,
    expected: dedent`
      for (let i_1 = 1; i_1 < 50; i_1++) {
        console.log("working");
      }
      for (let j_2 of [10, 20, 30]) {
        console.log("working");
      }
    `,
  },

  {
    name: "function calls in expressions",
    source: `
      ocean number x(){
        reel 1
      }
      cast: x()
    `,
    expected: dedent`
      function x_1() {
        return 1;
      }
      console.log(x_1());
    `,
  },

  {
    name: "function calls in statements",
    source: `
      ocean lost x(){
      }
      x()
    `,
    expected: dedent`
      function x_1() {
      }
      x_1();
    `,
  },

  {
    name: "try catch",
    source: `
      number x = 0
      pitch {
        cast: "working"
      } catch {
        cast: "not working"
      }
    `,
    expected: dedent`
      let x_1 = 0;
      try {
        console.log("working");
      } catch (e) {
        console.log("not working");
      }
    `,
  },
]

describe("The code generator", () => {
  for (const fixture of fixtures) {
    it(`produces expected js output for the ${fixture.name} program`, () => {
      const actual = generate(optimize(analyze(parse(fixture.source))))
      assert.deepEqual(actual, fixture.expected)
    })
  }
})
