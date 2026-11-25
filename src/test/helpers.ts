import { vi } from "vitest";

/** Simula `db.select().from().where()...`: encadeável e "awaitable". */
export function selectChain<T>(rows: T[]) {
  const promise = Promise.resolve(rows);
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    fullJoin: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
  return chain;
}
