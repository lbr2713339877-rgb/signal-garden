import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmTokenFor, hashToken, isTokenShape, newToken, tokenMatches, unsubTokenFor } from "./tokens";

test("confirm tokens are stored as hashes, not plaintext", () => {
  const token = newToken();
  const hash = hashToken(token);
  assert.equal(isTokenShape(token), true);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
  assert.equal(tokenMatches(token, hash), true);
  assert.equal(tokenMatches(newToken(), hash), false);
  assert.equal(tokenMatches("short", hash), false);
  assert.equal(tokenMatches(token, "ab"), false);
});

test("confirm tokens can be rebuilt from the subscriber and expiry", () => {
  const id = "6f1e0c3a-1b2c-4d5e-8f90-aabbccddeeff";
  const expires = Date.parse("2026-10-22T03:00:00.000Z");
  assert.equal(confirmTokenFor(id, expires, "secret-a"), confirmTokenFor(id, expires, "secret-a"));
  assert.notEqual(confirmTokenFor(id, expires, "secret-a"), confirmTokenFor(id, expires + 1000, "secret-a"));
  assert.notEqual(confirmTokenFor(id, expires, "secret-a"), unsubTokenFor(id, "secret-a"));
  assert.equal(isTokenShape(confirmTokenFor(id, expires, "secret-a")), true);
  assert.equal(tokenMatches(confirmTokenFor(id, expires), hashToken(confirmTokenFor(id, expires))), true);
});

test("unsubscribe tokens are stable for a subscriber and change with the secret", () => {
  const id = "6f1e0c3a-1b2c-4d5e-8f90-aabbccddeeff";
  assert.equal(unsubTokenFor(id, "secret-a"), unsubTokenFor(id, "secret-a"));
  assert.notEqual(unsubTokenFor(id, "secret-a"), unsubTokenFor(id, "secret-b"));
  assert.equal(tokenMatches(unsubTokenFor(id, "secret-a"), hashToken(unsubTokenFor(id, "secret-a"))), true);
});
