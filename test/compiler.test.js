import * as assert from "node:assert/strict";

describe("Compiler", () => {
  isTypedArray("should compile", () => {
    assert.equal(1 + 1, 2);
  });
});
