import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateGate, GATE } from "./growth";

test("a project above the total-star floor qualifies without growth proof", () => {
  const r = evaluateGate({ stars: 1200, stars24h: null, stars7d: null, forks7d: null });
  assert.equal(r.qualified, true);
  assert.equal(r.reason, "total-stars");
});

test("a small project qualifies on measured star growth", () => {
  const r = evaluateGate({ stars: 120, stars24h: 60, stars7d: null, forks7d: 0 });
  assert.equal(r.qualified, true);
  assert.equal(r.reason, "star-growth");
});

test("a small project qualifies on fork growth when star history is unavailable", () => {
  // This is the honest substitution: GitHub no longer exposes star history, so
  // fork growth stands in. The reason records which measure decided.
  const r = evaluateGate({ stars: 200, stars24h: null, stars7d: null, forks7d: GATE.forks7d });
  assert.equal(r.qualified, true);
  assert.equal(r.reason, "fork-growth");
  assert.match(r.detail, /fork/);
});

test("a small flat project does not qualify, and the detail says why", () => {
  const r = evaluateGate({ stars: 90, stars24h: 2, stars7d: 5, forks7d: 1 });
  assert.equal(r.qualified, false);
  assert.equal(r.reason, "unqualified");
  assert.match(r.detail, /未达门槛|增长/);
});

test("a project with no measurable growth yet is unqualified, not assumed good", () => {
  const r = evaluateGate({ stars: 30, stars24h: null, stars7d: null, forks7d: null });
  assert.equal(r.qualified, false);
  // The wording must not imply the project is bad, only that we cannot tell yet.
  assert.match(r.detail, /观察/);
});

test("the gate thresholds are the ones documented to the user", () => {
  assert.equal(GATE.totalStars, 500);
  assert.equal(GATE.stars24h, 50);
  assert.equal(GATE.forks7d, 15);
});

test("boundary values are inclusive", () => {
  assert.equal(evaluateGate({ stars: GATE.totalStars, stars24h: null, stars7d: null, forks7d: null }).qualified, true);
  assert.equal(evaluateGate({ stars: 1, stars24h: null, stars7d: null, forks7d: GATE.forks7d }).qualified, true);
  assert.equal(evaluateGate({ stars: 1, stars24h: null, stars7d: null, forks7d: GATE.forks7d - 1 }).qualified, false);
});
