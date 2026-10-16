import type { Item } from '../types';

export interface ExprContext {
  json: Item;
  index: number;
  items: Item[];
  byLabel: Record<string, Item[]>;
  now: Date;
  creds?: Record<string, string>;
}

const EXPR_RE = /\{\{([\s\S]+?)\}\}/g;

type ExprFn = (a: unknown, b: unknown, c: unknown, d: unknown, e: unknown, f: unknown) => unknown;

const compileCache = new Map<string, ExprFn>();

function compile(expr: string): ExprFn {
  let fn = compileCache.get(expr);
  if (!fn) {
    // eslint-disable-next-line no-new-func
    fn = new Function(
      '$json',
      '$items',
      '$index',
      '$node',
      '$now',
      '$creds',
      `"use strict"; return (${expr});`
    ) as ExprFn;
    if (compileCache.size > 400) compileCache.clear();
    compileCache.set(expr, fn);
  }
  return fn;
}

function makeNodeProxy(byLabel: Record<string, Item[]>) {
  return new Proxy(
    {},
    {
      get(_t, key: string) {
        const items = byLabel[key] ?? [];
        return {
          json: items[0] ?? {},
          items,
          all: () => items,
          first: () => items[0] ?? {},
        };
      },
    }
  );
}

export function evalExpression(expr: string, ctx: ExprContext): unknown {
  try {
    return compile(expr)(
      ctx.json,
      ctx.items,
      ctx.index,
      makeNodeProxy(ctx.byLabel),
      ctx.now,
      ctx.creds ?? {}
    );
  } catch {
    return undefined;
  }
}

/** Remplace les `{{ expressions }}` contenues dans une chaîne. */
export function resolveString(value: string, ctx: ExprContext): unknown {
  if (!value.includes('{{')) return value;
  const exact = value.trim().match(/^\{\{([\s\S]+)\}\}$/);
  if (exact) {
    const result = evalExpression(exact[1].trim(), ctx);
    return result === undefined ? value : result;
  }
  return value.replace(EXPR_RE, (full, expr: string) => {
    const result = evalExpression(expr.trim(), ctx);
    if (result === undefined) return full;
    if (result === null) return '';
    if (typeof result === 'object') return JSON.stringify(result);
    return String(result);
  });
}

/** Résout récursivement les expressions dans n'importe quelle valeur. */
export function resolveDeep<T>(value: T, ctx: ExprContext): unknown {
  if (typeof value === 'string') return resolveString(value, ctx);
  if (Array.isArray(value)) return value.map((v) => resolveDeep(v, ctx));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = resolveDeep(v, ctx);
    return out;
  }
  return value;
}

export function defaultCtx(byLabel: Record<string, Item[]> = {}): ExprContext {
  return { json: {}, index: 0, items: [], byLabel, now: new Date() };
}
