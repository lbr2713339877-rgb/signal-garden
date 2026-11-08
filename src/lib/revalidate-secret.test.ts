import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { test } from "node:test";
import { revalidatePublishedProjectPages } from "@/lib/project-revalidate";
import { handleRevalidatePaths } from "@/lib/revalidate-paths";
import {
  authorizeRevalidateRequest,
  isStrictLoopbackHost,
  revalidateTokenMatches,
  TRUSTED_REVALIDATE_ORIGIN,
  trustedRevalidateOrigin,
} from "@/lib/revalidate-secret";

const SECRET = "test-revalidate-secret";

function restoreSecret(previous: string | undefined) {
  if (previous === undefined) delete process.env.REVALIDATE_SECRET;
  else process.env.REVALIDATE_SECRET = previous;
}

async function withSecret<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const previous = process.env.REVALIDATE_SECRET;
  if (value === undefined) delete process.env.REVALIDATE_SECRET;
  else process.env.REVALIDATE_SECRET = value;
  try {
    return await fn();
  } finally {
    restoreSecret(previous);
  }
}

function post(host: string | null, headers: Record<string, string> = {}, body = '{"paths":[]}'): Request {
  const all: Record<string, string> = { "content-type": "application/json", ...headers };
  if (host) all.host = host;
  return new Request("http://127.0.0.1:3000/api/revalidate-paths", {
    method: "POST",
    headers: all,
    body,
  });
}

async function decide(request: Request): Promise<{ status: number; text: string; refreshed: string[] }> {
  const refreshed: string[] = [];
  const response = await handleRevalidatePaths(request, (path) => refreshed.push(path));
  return { status: response.status, text: await response.text(), refreshed };
}

test("strict host parsing accepts only an exact loopback name and an optional port", () => {
  for (const host of ["127.0.0.1", "127.0.0.1:3000", "localhost", "localhost:3000", "[::1]", "[::1]:3000"]) {
    assert.equal(isStrictLoopbackHost(host), true, host);
  }
  for (const host of [
    "",
    "signalgarden.site",
    "127.0.0.1.evil.com",
    "localhost.evil",
    "127.0.0.1.",
    "localhost.",
    "0.0.0.0",
    "127.0.0.2",
    "::1",
    "[::1]evil",
    "user@127.0.0.1",
    "127.0.0.1:0",
    "127.0.0.1:65536",
    "127.0.0.1:03000",
    "127.0.0.1:3000:1",
    "127.0.0.1 ",
    "[::ffff:127.0.0.1]",
  ]) {
    assert.equal(isStrictLoopbackHost(host), false, host);
  }
});

test("token comparison is digest equality and does not throw on a short token", () => {
  assert.equal(revalidateTokenMatches(SECRET, SECRET), true);
  assert.equal(revalidateTokenMatches(SECRET, `${SECRET}x`), false);
  assert.equal(revalidateTokenMatches(SECRET, SECRET.slice(0, -1)), false);
  assert.equal(revalidateTokenMatches(SECRET, ""), false);
  assert.equal(revalidateTokenMatches(SECRET, null), false);
  assert.equal(revalidateTokenMatches("", SECRET), false);
  assert.equal(revalidateTokenMatches(SECRET, ` ${SECRET}`), false);
  assert.equal(revalidateTokenMatches(SECRET, `${SECRET} `), false);
});

test("a correct token and a loopback host revalidate an empty path list", async () => {
  await withSecret(SECRET, async () => {
    const result = await decide(post("127.0.0.1:3000", { "x-revalidate-token": SECRET }, '{"paths":[]}'));
    assert.equal(result.status, 200);
    assert.equal(result.text, '{"ok":true,"paths":[]}');
    assert.deepEqual(result.refreshed, []);

    const fromUrl = await decide(post(null, { "x-revalidate-token": SECRET }));
    assert.equal(fromUrl.status, 200);
    assert.deepEqual(fromUrl.refreshed, []);
  });
});

test("a correct token does not authorize a public or disguised host", async () => {
  await withSecret(SECRET, async () => {
    for (const host of ["signalgarden.site", "127.0.0.1.evil.com", "localhost.evil", "127.0.0.1.", "0.0.0.0", "user@127.0.0.1"]) {
      const result = await decide(post(host, {
        "x-revalidate-token": SECRET,
        "x-forwarded-for": "127.0.0.1",
        "x-real-ip": "127.0.0.1",
        "x-forwarded-host": "127.0.0.1:3000",
      }, '{"paths":["/p/widget"]}'));
      assert.equal(result.status, 403, host);
      assert.equal(result.text, '{"ok":false}');
      assert.deepEqual(result.refreshed, []);
    }
  });
});

test("missing config, a missing token, a wrong token, and forged proxy headers all refuse", async () => {
  const widget = '{"paths":["/p/widget"]}';
  const forged = {
    host: "127.0.0.1:3000",
    "x-forwarded-for": "127.0.0.1",
    "x-real-ip": "127.0.0.1",
    "x-forwarded-host": "127.0.0.1:3000",
  };
  await withSecret(undefined, async () => {
    const cases: Array<Record<string, string>> = [
      { host: "127.0.0.1:3000" },
      { host: "127.0.0.1:3000", "x-forwarded-for": "127.0.0.1" },
      forged,
      {
        host: "signalgarden.site",
        "x-real-ip": "203.0.113.5",
        "x-forwarded-for": "127.0.0.1, 203.0.113.5",
        "x-forwarded-host": "signalgarden.site",
        "x-revalidate-token": SECRET,
      },
    ];
    for (const headers of cases) {
      const result = await decide(post(null, headers, widget));
      assert.equal(result.status, 403);
      assert.equal(result.text, '{"ok":false}');
      assert.equal(result.text.includes(SECRET), false);
      assert.deepEqual(result.refreshed, []);
    }
  });

  await withSecret("   ", async () => {
    const blank = await decide(post("127.0.0.1:3000", { "x-revalidate-token": SECRET }, widget));
    assert.equal(blank.status, 403);
    assert.deepEqual(blank.refreshed, []);
  });

  await withSecret(SECRET, async () => {
    const missing = await decide(post("127.0.0.1:3000", forged, widget));
    assert.equal(missing.status, 403);
    assert.equal(missing.text, '{"ok":false}');
    const wrong = await decide(post("127.0.0.1:3000", { ...forged, "x-revalidate-token": `${SECRET}x` }, widget));
    assert.equal(wrong.status, 403);
    assert.equal(wrong.text, '{"ok":false}');
    assert.equal(wrong.text.includes(SECRET), false);
    const nginx = await decide(post("signalgarden.site", {
      "x-revalidate-token": SECRET,
      "x-real-ip": "203.0.113.5",
      "x-forwarded-for": "127.0.0.1, 203.0.113.5",
      "x-forwarded-host": "signalgarden.site",
    }, widget));
    assert.equal(nginx.status, 403);
    assert.deepEqual(nginx.refreshed, []);
  });
});

test("proxy headers do not change the decision once the token and host are fixed", async () => {
  await withSecret(SECRET, async () => {
    const chains: Array<Record<string, string>> = [
      {},
      { "x-forwarded-for": "127.0.0.1" },
      { "x-forwarded-for": "::ffff:127.0.0.1" },
      { "x-forwarded-for": "127.0.0.1, 203.0.113.5" },
      { "x-forwarded-for": "" },
      { "x-forwarded-for": "127.0.0.1," },
      { "x-forwarded-for": "203.0.113.5", "x-real-ip": "203.0.113.5", "x-forwarded-host": "signalgarden.site" },
    ];
    const statuses: number[] = [];
    for (const extra of chains) {
      const result = await decide(post("127.0.0.1:3000", { "x-revalidate-token": SECRET, ...extra }));
      statuses.push(result.status);
      assert.deepEqual(result.refreshed, []);
    }
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 200, 200]);
  });
});

test("only /p slugs are refreshed and a malformed body refreshes nothing", async () => {
  await withSecret(SECRET, async () => {
    const listed = await decide(post("127.0.0.1:3000", { "x-revalidate-token": SECRET }, JSON.stringify({
      paths: ["/p/widget", "/today", "/login", "/p/not a slug", "/p/widget", "/p/Bad"],
    })));
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.refreshed, ["/p/widget"]);

    const broken = await decide(post("127.0.0.1:3000", { "x-revalidate-token": SECRET }, "{"));
    assert.equal(broken.status, 200);
    assert.equal(broken.text, '{"ok":true,"paths":[]}');
    assert.deepEqual(broken.refreshed, []);

    const shaped = await decide(post("127.0.0.1:3000", { "x-revalidate-token": SECRET }, '{"paths":"/p/widget"}'));
    assert.equal(shaped.status, 200);
    assert.deepEqual(shaped.refreshed, []);
  });
});

test("a refused request does not read the body or refresh", async () => {
  await withSecret(SECRET, async () => {
    let read = false;
    const request = post("signalgarden.site", { "x-revalidate-token": SECRET }, "{");
    request.json = async () => {
      read = true;
      throw new Error("body was read before authorization");
    };
    const result = await decide(request);
    assert.equal(result.status, 403);
    assert.equal(read, false);
    assert.deepEqual(result.refreshed, []);
  });
});

test("authorization reads the secret at call time", async () => {
  const request = post("[::1]:3000", { "x-revalidate-token": SECRET });
  await withSecret(SECRET, async () => {
    assert.equal(authorizeRevalidateRequest(request), true);
  });
  await withSecret(`${SECRET}x`, async () => {
    assert.equal(authorizeRevalidateRequest(request), false);
  });
});

test("the caller does not fetch without a configured secret and does not log the secret", async () => {
  await withSecret(undefined, async () => {
    let called = false;
    await assert.rejects(
      () => revalidatePublishedProjectPages({
        slugs: ["widget"],
        fetchImpl: async () => {
          called = true;
          return new Response("{}", { status: 200 });
        },
      }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, "revalidate secret is not configured");
        return true;
      },
    );
    assert.equal(called, false);
  });

  await withSecret(" \n ", async () => {
    let called = false;
    await assert.rejects(
      () => revalidatePublishedProjectPages({
        slugs: ["widget"],
        fetchImpl: async () => {
          called = true;
          return new Response("{}", { status: 200 });
        },
      }),
      /revalidate secret is not configured/,
    );
    assert.equal(called, false);
  });

  await withSecret(SECRET, async () => {
    await assert.rejects(
      () => revalidatePublishedProjectPages({
        slugs: ["widget"],
        fetchImpl: async () => new Response(`denied ${SECRET}`, { status: 403 }),
      }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message.includes(SECRET), false);
        assert.match(err.message, /^revalidate 403 /);
        assert.match(err.message, /\[redacted\]/);
        return true;
      },
    );
    await assert.rejects(
      () => revalidatePublishedProjectPages({
        slugs: ["widget"],
        fetchImpl: async () => {
          throw new Error(`connect ${SECRET}`);
        },
      }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message.includes(SECRET), false);
        assert.match(err.message, /^revalidate unreachable /);
        return true;
      },
    );
  });
});

test("the caller fetches only the trusted loopback origin and does not follow redirects", async () => {
  assert.equal(trustedRevalidateOrigin(TRUSTED_REVALIDATE_ORIGIN), TRUSTED_REVALIDATE_ORIGIN);
  assert.equal(trustedRevalidateOrigin(`${TRUSTED_REVALIDATE_ORIGIN}/`), TRUSTED_REVALIDATE_ORIGIN);
  assert.equal(trustedRevalidateOrigin(`${TRUSTED_REVALIDATE_ORIGIN}///`), TRUSTED_REVALIDATE_ORIGIN);
  assert.equal(isStrictLoopbackHost("127.0.0.1:3000"), true);

  const refused = [
    "",
    " ",
    "http://127.0.0.1:3000 ",
    "HTTP://127.0.0.1:3000",
    "https://127.0.0.1:3000",
    "http://localhost:3000",
    "http://[::1]:3000",
    "http://127.0.0.1",
    "http://127.0.0.1:80",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:03000",
    "http://user:pass@127.0.0.1:3000",
    "http://127.0.0.1.evil.com:3000",
    "http://127.0.0.1.evil.com",
    "http://signalgarden.site",
    "https://signalgarden.site/api/revalidate-paths",
    "http://127.0.0.1:3000/api",
    "http://127.0.0.1:3000/api/revalidate-paths",
    "http://127.0.0.1:3000?x=1",
    "http://127.0.0.1:3000#frag",
    "http://127.0.0.1:3000\\@evil.example",
    "http://127.0.0.1:3000%2eevil",
    "javascript:alert(1)",
    "http://0.0.0.0:3000",
  ];
  for (const origin of refused) {
    assert.equal(trustedRevalidateOrigin(origin), null, origin);
  }

  await withSecret(SECRET, async () => {
    for (const origin of refused) {
      let called = false;
      await assert.rejects(
        () => revalidatePublishedProjectPages({
          slugs: ["widget"],
          origin,
          fetchImpl: async () => {
            called = true;
            return new Response("{}", { status: 200 });
          },
        }),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.equal(err.message, "revalidate origin is not allowed");
          assert.equal(err.message.includes(SECRET), false);
          assert.equal(err.message.includes("pass"), false);
          assert.equal(err.message.includes("signalgarden"), false);
          return true;
        },
      );
      assert.equal(called, false, origin);
    }

    const previousOrigin = process.env.REVALIDATE_ORIGIN;
    process.env.REVALIDATE_ORIGIN = "https://signalgarden.site";
    try {
      let called = false;
      await assert.rejects(
        () => revalidatePublishedProjectPages({
          slugs: ["widget"],
          fetchImpl: async () => {
            called = true;
            return new Response("{}", { status: 200 });
          },
        }),
        /revalidate origin is not allowed/,
      );
      assert.equal(called, false);
    } finally {
      if (previousOrigin === undefined) delete process.env.REVALIDATE_ORIGIN;
      else process.env.REVALIDATE_ORIGIN = previousOrigin;
    }

    let calls = 0;
    const slashed = await revalidatePublishedProjectPages({
      slugs: ["widget"],
      origin: `${TRUSTED_REVALIDATE_ORIGIN}/`,
      fetchImpl: async (input, init) => {
        calls += 1;
        assert.equal(String(input), `${TRUSTED_REVALIDATE_ORIGIN}/api/revalidate-paths`);
        assert.equal(init?.redirect, "error");
        assert.equal(new Headers(init?.headers).get("x-revalidate-token"), SECRET);
        return new Response("{}", { status: 200 });
      },
    });
    assert.equal(calls, 1);
    assert.equal(slashed.itemsOut, 1);
    assert.equal(JSON.stringify(slashed).includes(SECRET), false);
  });

  const hits: { method: string; url: string; token: string | undefined }[] = [];
  const server = createServer((req, res) => {
    const token = req.headers["x-revalidate-token"];
    hits.push({
      method: req.method ?? "",
      url: req.url ?? "",
      token: Array.isArray(token) ? token.join(",") : token,
    });
    res.writeHead(302, { location: `${TRUSTED_REVALIDATE_ORIGIN}/capture` });
    res.end();
  });
  server.listen(3000, "127.0.0.1");
  await once(server, "listening");
  const previousOrigin = process.env.REVALIDATE_ORIGIN;
  delete process.env.REVALIDATE_ORIGIN;
  try {
    await withSecret(SECRET, async () => {
      await assert.rejects(
        () => revalidatePublishedProjectPages({ slugs: ["widget"] }),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.equal(err.message.includes(SECRET), false);
          assert.match(err.message, /^revalidate unreachable /);
          return true;
        },
      );
    });
  } finally {
    if (previousOrigin === undefined) delete process.env.REVALIDATE_ORIGIN;
    else process.env.REVALIDATE_ORIGIN = previousOrigin;
    server.close();
    await once(server, "close");
  }
  assert.deepEqual(hits.map((hit) => ({ method: hit.method, url: hit.url })), [
    { method: "POST", url: "/api/revalidate-paths" },
  ]);
  assert.equal(hits[0]?.token, SECRET);
});

test("the secret stays a runtime bracket read outside pages and next.config", () => {
  const secretSource = readFileSync("src/lib/revalidate-secret.ts", "utf8");
  const routeSource = readFileSync("src/lib/revalidate-paths.ts", "utf8");
  assert.match(secretSource, /env\["REVALIDATE_SECRET"\]/);
  assert.doesNotMatch(secretSource, /NEXT_PUBLIC_REVALIDATE_SECRET/);
  assert.equal(secretSource.includes("const secret ="), false);
  assert.ok(routeSource.indexOf("authorizeRevalidateRequest") < routeSource.indexOf("request.json"));
  assert.ok(routeSource.indexOf("request.json") < routeSource.indexOf("revalidate(path)"));
  assert.doesNotMatch(readFileSync("next.config.ts", "utf8"), /REVALIDATE_SECRET/);
  assert.doesNotMatch(readFileSync("src/app/api/revalidate-paths/route.ts", "utf8"), /REVALIDATE_SECRET/);
  const callerSource = readFileSync("src/lib/project-revalidate.ts", "utf8");
  assert.ok(callerSource.indexOf("trustedRevalidateOrigin") < callerSource.indexOf("x-revalidate-token"));
  assert.match(callerSource, /redirect:\s*"error"/);

  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".ts") || name.endsWith(".tsx")) hits.push(path);
    }
  };
  walk("src");
  const mentioned = hits.filter((path) => readFileSync(path, "utf8").includes("REVALIDATE_SECRET"));
  assert.deepEqual(mentioned.sort(), [
    "src/lib/project-revalidate.test.ts",
    "src/lib/revalidate-secret.test.ts",
    "src/lib/revalidate-secret.ts",
  ]);
});
