import assert from "node:assert/strict";
import parse from "../src/parser.js";

const syntaxChecks = [
  ["all numeric literal forms", "cast:(8 * 89.123)"], 
  ["all unary operators", "cast: (-3) cast: (!false)"], 
  ["all binary operators", "cast: x && y || z * 1 / 2 ** 3 + 4 < 5"], 
  ["all arithmetic operators", "x = (!3) * 2 + 4 - (-7.3) * 8 ** 13 / 1"], 
  ["digits work with fraction and exponents", "number = 3.33E33"],
  ["all relational operators", "x = 1<(2<=(3==(4!=(5 >= (6>7)))))"], 
  ["all logical operators", "x = hooked && unhooked || (!unhooked)"], 
  ["end of program inside comment", "cast:(0) // yay"], 
  ["for statement properly functions", "stream fish in basket{ x=2 }"],
  ["comments with no text are ok", "cast:(1) //\ncast:(0)//"], 
  ["non-Latin letters in identifiers", "コンパイラ = 100"], 
  ["break statement test", "if(x<= 2){ snap }"],
  ["while loop statement test", "tide(x < 10){ cast:(x)}"],
  ["return statement test", "if(x==2){ reel x}"],
  ["continue statement test", "if(x==2) { flow }"],
  ["null statement test", "x = sock"],
  ["try and catch expections work properly","pitch{ x = 2/0} catch(Number Exception){ cast: x == 2 }"],
  ["if else statement test", "if(x > 2){ reel hooked}else{reel unhooked} "],
  ["public class defined correctly", "ocean school hello: x = 2" ],
  ["private class defined", "lake school hello: x = 2"],
  ["struct declaration works as intended", "boat x{x = 2}"],
  ["flow statement works properly", "if(x > 2){ flow }"],
  
  
];

const syntaxErrors = [
  ["non-letter in an identifier", "ab😭c = 2", /Line 1, col 3/], 
  ["malformed number", "x= 2.", /Line 1, col 6/], 
  ["missing id", " = 3, y = 1", /Line 1, col 2/], 
  ["a missing right operand", "cast:(5 -", /Line 1, col 10/],
  ["a non-operator", "cast:(7 * ((2 _ 3)", /Line 1, col 15/], 
  ["an expression starting with a )", "x = )", /Line 1, col 5/], 
  ["a statement starting with expression", "x * 5", /Line 1, col 3/], 
  ["an illegal statement on line 2", "cast:(5)\nx * 5", /Line 2, col 3/], 
  ["a statement starting with a )", "cast:(5)\n) * 5", /Line 2, col 1/], 
  ["an expression starting with a *", "x = * 71", /Line 1, col 5/], 
  ["an expression starting with a %", "x = % 71", /Line 1, col 5/],
  ["print (cast) lacking :", "cast x = 2", /Line 1, col 6/],
  ["variable can't be class", "ocean 2 hello: x = 2", /Line 1, col 7/],
  ["keywords can't be used in variable declaration", "sock = 2", /Line 1, col 1/ ],
  ["Can't have non integer after .", "x = 2.hello", /Line 1, col 7/],
  
];

describe("The parser", () => {
  for (const [scenario, source] of syntaxChecks) {
    it(`properly specifies ${scenario}`, () => {
      assert(parse(source).succeeded());
    });
  }
  for (const [scenario, source, errorMessagePattern] of syntaxErrors) {
    it(`does not permit ${scenario}`, () => {
      assert.throws(() => parse(source), errorMessagePattern);
    });
  }
});
