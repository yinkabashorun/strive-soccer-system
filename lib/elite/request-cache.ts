import * as React from "react";

// One read per request. A screen of the member app is a layout and a page
// that both need the signed-in viewer, the player row and the week's
// homework; without this each asks the database again, one after the
// other. Inside a render, React's cache() hands the second caller the
// first caller's answer (a fresh cache for every request, so nothing is
// ever shared between two people or two requests). A server action runs
// outside a render, so an action always reads the database itself.
//
// React's cache() only exists in the build Next.js ships for the server
// (react-server). Anywhere else (a unit test, a script) the function is
// returned as it is, so behaviour never depends on the cache being there.
type AnyFn = (...args: never[]) => unknown;

export function perRequest<F extends AnyFn>(fn: F): F {
  const cache = (React as unknown as { cache?: <T extends AnyFn>(f: T) => T }).cache;
  return typeof cache === "function" ? cache(fn) : fn;
}
