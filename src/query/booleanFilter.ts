/**
 * Boolean combinations of filters, following the Tasks syntax
 * (https://publish.obsidian.md/tasks/Queries/Combining+Filters):
 *
 *   (due before tomorrow) OR (no due date)
 *   NOT (tag includes #someday)
 *   ((path includes Work) OR (tag includes #work)) AND NOT (done today)
 *
 * Each filter is wrapped in one delimiter type per line — `( )`, `[ ]`, `{ }`
 * or `" "` — and joined with the case-sensitive operators `AND`, `OR`, `XOR`,
 * `NOT`, `AND NOT` and `OR NOT`. Precedence, highest first: `NOT`, `XOR`,
 * `AND`, `OR`.
 *
 * The module is generic over the leaf filter type so the expression grammar
 * stays independent of the filters it combines.
 */

export type BooleanExpr<T> =
  | { op: "leaf"; filter: T }
  | { op: "not"; operand: BooleanExpr<T> }
  | { op: "and" | "or" | "xor"; left: BooleanExpr<T>; right: BooleanExpr<T> };

export interface LeafParseResult<T> {
  filter?: T;
  error?: string;
  warning?: string;
}

export interface BooleanParseResult<T> {
  expr?: BooleanExpr<T>;
  error?: string;
  warnings: string[];
}

const DELIMITERS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
};

type Operator = "AND" | "OR" | "XOR" | "NOT";

type Token =
  | { type: "group"; inner: string; text: string }
  | { type: "op"; value: Operator };

class BooleanSyntaxError extends Error {}

/**
 * Whether a line is a Boolean instruction rather than a plain filter: it starts
 * with a delimiter, optionally preceded by `NOT`.
 */
export function isBooleanInstruction(line: string): boolean {
  return /^(?:NOT\b\s*)*[([{"]/.test(line.trim());
}

/**
 * Parse a Boolean instruction, delegating each delimited filter to `parseLeaf`.
 * The first error (syntax or leaf) aborts the parse; leaf warnings are
 * collected.
 */
export function parseBooleanExpression<T>(
  line: string,
  parseLeaf: (text: string) => LeafParseResult<T>,
): BooleanParseResult<T> {
  const warnings: string[] = [];
  const source = line.trim();
  const open = /^(?:NOT\b\s*)*(.)/.exec(source)?.[1] ?? "";
  if (!(open in DELIMITERS)) {
    return {
      error:
        'all filters in a Boolean instruction must be wrapped in (...), [...], {...} or "..."',
      warnings,
    };
  }

  try {
    const expr = parseExpression(source, open, parseLeaf, warnings);
    return { expr, warnings };
  } catch (error) {
    if (error instanceof BooleanSyntaxError) {
      return { error: error.message, warnings };
    }
    throw error;
  }
}

/** Evaluate an expression, deciding each leaf with `matches`. */
export function evaluateBooleanExpression<T>(
  expr: BooleanExpr<T>,
  matches: (filter: T) => boolean,
): boolean {
  switch (expr.op) {
    case "leaf":
      return matches(expr.filter);
    case "not":
      return !evaluateBooleanExpression(expr.operand, matches);
    case "and":
      return (
        evaluateBooleanExpression(expr.left, matches) &&
        evaluateBooleanExpression(expr.right, matches)
      );
    case "or":
      return (
        evaluateBooleanExpression(expr.left, matches) ||
        evaluateBooleanExpression(expr.right, matches)
      );
    case "xor":
      return (
        evaluateBooleanExpression(expr.left, matches) !==
        evaluateBooleanExpression(expr.right, matches)
      );
  }
}

/** Recursive-descent parse of one nesting level. */
function parseExpression<T>(
  text: string,
  open: string,
  parseLeaf: (text: string) => LeafParseResult<T>,
  warnings: string[],
): BooleanExpr<T> {
  const tokens = tokenize(text, open);
  let pos = 0;

  const peekOp = (value: Operator): boolean => {
    const token = tokens[pos];
    return token?.type === "op" && token.value === value;
  };

  const parseOr = (): BooleanExpr<T> => {
    let left = parseAnd();
    while (peekOp("OR")) {
      pos++;
      left = { op: "or", left, right: parseAnd() };
    }
    return left;
  };

  const parseAnd = (): BooleanExpr<T> => {
    let left = parseXor();
    while (peekOp("AND")) {
      pos++;
      left = { op: "and", left, right: parseXor() };
    }
    return left;
  };

  const parseXor = (): BooleanExpr<T> => {
    let left = parseUnary();
    while (peekOp("XOR")) {
      pos++;
      left = { op: "xor", left, right: parseUnary() };
    }
    return left;
  };

  const parseUnary = (): BooleanExpr<T> => {
    if (peekOp("NOT")) {
      pos++;
      return { op: "not", operand: parseUnary() };
    }
    const token = tokens[pos];
    if (token?.type !== "group") {
      const previous = tokens[pos - 1];
      const after = previous?.type === "op" ? ` after "${previous.value}"` : "";
      throw new BooleanSyntaxError(
        `expected a filter wrapped in ${open}...${DELIMITERS[open]}${after}`,
      );
    }
    pos++;
    return parseGroup(token.inner);
  };

  const parseGroup = (inner: string): BooleanExpr<T> => {
    const content = inner.trim();
    if (content === "") {
      throw new BooleanSyntaxError("empty filter");
    }
    if (open !== '"' && isNestedExpression(content, open)) {
      return parseExpression(content, open, parseLeaf, warnings);
    }
    const result = parseLeaf(content);
    if (result.error !== undefined || result.filter === undefined) {
      throw new BooleanSyntaxError(
        result.error ?? `unsupported filter "${content}"`,
      );
    }
    if (result.warning) {
      warnings.push(result.warning);
    }
    return { op: "leaf", filter: result.filter };
  };

  const expr = parseOr();
  if (pos < tokens.length) {
    const token = tokens[pos];
    throw new BooleanSyntaxError(
      token.type === "group"
        ? `expected an operator (AND, OR, XOR) before "${token.text}"`
        : `unexpected "${token.value}"`,
    );
  }
  return expr;
}

/** Whether delimited content is itself an expression rather than a filter. */
function isNestedExpression(content: string, open: string): boolean {
  return content.startsWith(open) || /^NOT\b/.test(content);
}

/** Split one nesting level into delimited groups and operators. */
function tokenize(text: string, open: string): Token[] {
  const close = DELIMITERS[open];
  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i++;
      continue;
    }

    if (text[i] === open) {
      const end = findClose(text, i, open, close);
      if (end === -1) {
        throw new BooleanSyntaxError(`missing closing "${close}"`);
      }
      tokens.push({
        type: "group",
        inner: text.slice(i + 1, end),
        text: text.slice(i, end + 1),
      });
      i = end + 1;
      continue;
    }

    const rest = text.slice(i);
    const op = /^(AND|OR|XOR|NOT)(?![A-Za-z0-9_])/.exec(rest);
    if (op) {
      tokens.push({ type: "op", value: op[1] as Operator });
      i += op[1].length;
      continue;
    }

    const lowercase = /^(and|or|xor|not)(?![A-Za-z0-9_])/i.exec(rest);
    if (lowercase) {
      throw new BooleanSyntaxError(
        `operators must be capitalised: use "${lowercase[1].toUpperCase()}"`,
      );
    }

    throw new BooleanSyntaxError(
      `expected an operator or a filter wrapped in ${open}...${close}, found "${rest}"`,
    );
  }

  return tokens;
}

/**
 * Index of the delimiter closing the one at `start`. Nested pairs of the same
 * delimiter are balanced, so `(description includes (maybe))` is one filter.
 */
function findClose(
  text: string,
  start: number,
  open: string,
  close: string,
): number {
  if (open === close) {
    return text.indexOf(close, start + 1);
  }
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) {
      depth++;
    } else if (text[i] === close) {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}
