import { describe, it, expect } from "vitest";
import {
  evaluateBooleanExpression,
  isBooleanInstruction,
  parseBooleanExpression,
  type BooleanExpr,
} from "../src/query/booleanFilter";

/** A leaf parser accepting single lowercase words, rejecting anything else. */
function parseLeaf(text: string): {
  filter?: string;
  error?: string;
  warning?: string;
} {
  if (text === "legacy") {
    return { filter: text, warning: "legacy is deprecated" };
  }
  if (/^[a-z][a-z ()]*$/.test(text)) {
    return { filter: text };
  }
  return { error: `bad leaf "${text}"` };
}

function parse(line: string) {
  return parseBooleanExpression(line, parseLeaf);
}

function expr(line: string): BooleanExpr<string> {
  const result = parse(line);
  expect(result.error).toBeUndefined();
  return result.expr as BooleanExpr<string>;
}

/** Evaluate with the given set of leaves considered true. */
function evaluate(line: string, truthy: string[]): boolean {
  return evaluateBooleanExpression(expr(line), (leaf) => truthy.includes(leaf));
}

describe("isBooleanInstruction", () => {
  it("recognises lines starting with a delimiter", () => {
    for (const line of [
      "(a) OR (b)",
      "[a] OR [b]",
      "{a} OR {b}",
      '"a" OR "b"',
    ]) {
      expect(isBooleanInstruction(line)).toBe(true);
    }
  });

  it("recognises lines starting with NOT", () => {
    expect(isBooleanInstruction("NOT (a)")).toBe(true);
    expect(isBooleanInstruction("NOT(a)")).toBe(true);
  });

  it("ignores plain filter lines", () => {
    for (const line of [
      "due before tomorrow",
      "no due date",
      "tag includes #work",
      "NOTE something",
    ]) {
      expect(isBooleanInstruction(line)).toBe(false);
    }
  });
});

describe("parseBooleanExpression", () => {
  it("parses a single delimited filter as a leaf", () => {
    expect(expr("(a)")).toEqual({ op: "leaf", filter: "a" });
  });

  it("trims whitespace inside delimiters", () => {
    expect(expr("(  a b  )")).toEqual({ op: "leaf", filter: "a b" });
  });

  it("parses OR, AND and XOR into binary nodes", () => {
    expect(expr("(a) OR (b)")).toEqual({
      op: "or",
      left: { op: "leaf", filter: "a" },
      right: { op: "leaf", filter: "b" },
    });
    expect(expr("(a) AND (b)").op).toBe("and");
    expect(expr("(a) XOR (b)").op).toBe("xor");
  });

  it("parses NOT, AND NOT and OR NOT", () => {
    expect(expr("NOT (a)")).toEqual({
      op: "not",
      operand: { op: "leaf", filter: "a" },
    });
    expect(expr("(a) AND NOT (b)")).toEqual({
      op: "and",
      left: { op: "leaf", filter: "a" },
      right: { op: "not", operand: { op: "leaf", filter: "b" } },
    });
    expect(expr("(a) OR NOT (b)")).toEqual({
      op: "or",
      left: { op: "leaf", filter: "a" },
      right: { op: "not", operand: { op: "leaf", filter: "b" } },
    });
  });

  it("applies Tasks' precedence: NOT, then XOR, then AND, then OR", () => {
    expect(expr("(a) OR (b) AND (c)")).toEqual({
      op: "or",
      left: { op: "leaf", filter: "a" },
      right: {
        op: "and",
        left: { op: "leaf", filter: "b" },
        right: { op: "leaf", filter: "c" },
      },
    });
    expect(expr("(a) AND (b) XOR (c)")).toEqual({
      op: "and",
      left: { op: "leaf", filter: "a" },
      right: {
        op: "xor",
        left: { op: "leaf", filter: "b" },
        right: { op: "leaf", filter: "c" },
      },
    });
  });

  it("parses nested groups", () => {
    expect(expr("((a) OR (b)) AND (c)")).toEqual({
      op: "and",
      left: {
        op: "or",
        left: { op: "leaf", filter: "a" },
        right: { op: "leaf", filter: "b" },
      },
      right: { op: "leaf", filter: "c" },
    });
    expect(expr("NOT ((a) OR (b))").op).toBe("not");
    expect(expr("(NOT (a)) AND (b)").op).toBe("and");
  });

  it("supports every Tasks delimiter type", () => {
    for (const line of ["[a] OR [b]", "{a} OR {b}", '"a" OR "b"']) {
      expect(expr(line)).toEqual({
        op: "or",
        left: { op: "leaf", filter: "a" },
        right: { op: "leaf", filter: "b" },
      });
    }
  });

  it("allows balanced parentheses inside ( ) filters", () => {
    expect(expr("(a (maybe)) OR (b)")).toEqual({
      op: "or",
      left: { op: "leaf", filter: "a (maybe)" },
      right: { op: "leaf", filter: "b" },
    });
  });

  it("treats other delimiter characters as plain text inside filters", () => {
    expect(expr("[a (x] OR [b]")).toEqual({
      op: "or",
      left: { op: "leaf", filter: "a (x" },
      right: { op: "leaf", filter: "b" },
    });
  });

  it("chains several operators of the same kind left to right", () => {
    expect(expr("(a) OR (b) OR (c)")).toEqual({
      op: "or",
      left: {
        op: "or",
        left: { op: "leaf", filter: "a" },
        right: { op: "leaf", filter: "b" },
      },
      right: { op: "leaf", filter: "c" },
    });
  });

  it("collects leaf warnings", () => {
    const result = parse("(legacy) OR (b)");
    expect(result.error).toBeUndefined();
    expect(result.warnings).toEqual(["legacy is deprecated"]);
  });

  describe("errors", () => {
    const cases: Array<[string, string]> = [
      ["(a) OR", "expected"],
      ["(a) (b)", "expected an operator"],
      ["(a) or (b)", 'must be capitalised: use "OR"'],
      ["(a) OR b", "expected"],
      ["(a", 'missing closing ")"'],
      ["((a) OR (b)", 'missing closing ")"'],
      ["() OR (b)", "empty filter"],
      ["(a) OR [b]", "expected"],
      ["(A) OR (b)", 'bad leaf "A"'],
      ["NOT", "must be wrapped"],
      ["NOT ()", "empty filter"],
      ["(a) AND NOT", 'after "NOT"'],
    ];

    for (const [line, message] of cases) {
      it(`rejects ${JSON.stringify(line)}`, () => {
        const result = parse(line);
        expect(result.expr).toBeUndefined();
        expect(result.error).toContain(message);
      });
    }
  });
});

describe("evaluateBooleanExpression", () => {
  it("evaluates OR", () => {
    expect(evaluate("(a) OR (b)", ["a"])).toBe(true);
    expect(evaluate("(a) OR (b)", ["b"])).toBe(true);
    expect(evaluate("(a) OR (b)", [])).toBe(false);
  });

  it("evaluates AND", () => {
    expect(evaluate("(a) AND (b)", ["a", "b"])).toBe(true);
    expect(evaluate("(a) AND (b)", ["a"])).toBe(false);
  });

  it("evaluates NOT and AND NOT", () => {
    expect(evaluate("NOT (a)", [])).toBe(true);
    expect(evaluate("NOT (a)", ["a"])).toBe(false);
    expect(evaluate("(a) AND NOT (b)", ["a"])).toBe(true);
    expect(evaluate("(a) AND NOT (b)", ["a", "b"])).toBe(false);
  });

  it("evaluates XOR", () => {
    expect(evaluate("(a) XOR (b)", ["a"])).toBe(true);
    expect(evaluate("(a) XOR (b)", ["a", "b"])).toBe(false);
    expect(evaluate("(a) XOR (b)", [])).toBe(false);
  });

  it("respects precedence when evaluating", () => {
    // (a) OR ((b) AND (c))
    expect(evaluate("(a) OR (b) AND (c)", ["a"])).toBe(true);
    expect(evaluate("(a) OR (b) AND (c)", ["b"])).toBe(false);
  });
});
