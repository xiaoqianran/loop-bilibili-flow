/** Resolve bundled Application capabilities without unsafe casts or prototype traversal. */
import type * as app from "../app";
export type AppRegistry = typeof app;
type Method = (...args: never[]) => unknown;
/** Every valid method path is checked against the actual compiled Application exports. */
export type AppMethodPath<T = AppRegistry> = {
  [K in Extract<keyof T, string>]:
    T[K] extends Method ? K
      : T[K] extends object ? (AppMethodPath<T[K]> extends infer P
        ? P extends string ? ("" extends P ? never : ("" extends K ? never : `${K}.${P}`)) : never
        : never)
      : never
}[Extract<keyof T, string>];
export type AppCallable = (...args: unknown[]) => unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === "object" || typeof value === "function");
}
export function resolveAppMethod(registry: unknown, path: string): AppCallable | null {
  if (!isRecord(registry) || !path) return null;
  const parts = path.split(".");
  if (parts.some(part => !part || part === "__proto__" || part === "constructor" || part === "prototype")) {
    return null;
  }
  let cursor: unknown = registry;
  for (const part of parts) {
    if (!isRecord(cursor) || !Object.hasOwn(cursor, part)) return null;
    cursor = cursor[part];
  }
  return typeof cursor === "function" ? cursor as AppCallable : null;
}


/** Compile-time relationship between a literal Application path and its real parameters/result. */
type MethodAt<T, P extends string> =
  P extends `${infer K}.${infer Rest}` ? K extends keyof T ? MethodAt<T[K], Rest> : never
    : P extends keyof T ? T[P] : never;
export type AppMethodArgs<P extends AppMethodPath> =
  MethodAt<AppRegistry, P> extends (...args: infer Args) => unknown ? Args : never;
export type AppMethodResult<P extends AppMethodPath> =
  MethodAt<AppRegistry, P> extends (...args: never[]) => infer Result ? Result : never;

/** Runtime checks remain necessary because the userscript composition root is injected. */
export function callApp<P extends AppMethodPath>(
  registry: unknown, path: P, ...args: AppMethodArgs<P>
): AppMethodResult<P> {
  const fn = resolveAppMethod(registry, path);
  if (!fn) throw new Error("Application capability missing: " + path);
  return fn(...args) as AppMethodResult<P>;
}
