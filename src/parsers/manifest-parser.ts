/**
 * Root manifests: package.json, pyproject.toml, requirements.txt, and the MCP /
 * Claude plugin markers. Used for dependencies, runtime, and MCP evidence.
 */

export interface ManifestFacts {
  runtime: "node" | "python" | null;
  packageName: string | null;
  dependencies: string[];
  hasBin: boolean;
  /** preinstall / install / postinstall — code that runs on install. */
  installScripts: { name: string; command: string }[];
  keywords: string[];
  /** Depends on an MCP server SDK. */
  hasMcpSdk: boolean;
  /** server.json (MCP registry) or smithery.yaml — publishes an MCP server. */
  hasMcpServerManifest: boolean;
  /** .mcp.json configures servers the repo *uses*; weak evidence it *is* one. */
  hasMcpClientConfig: boolean;
  hasClaudePlugin: boolean;
  hasClaudeMarketplace: boolean;
  evidence: string[];
}

const NODE_MCP = ["@modelcontextprotocol/sdk", "fastmcp", "mcp-framework", "@mastra/mcp", "mcp-use"];
const PY_MCP = /^\s*["']?(mcp|fastmcp)(\[[\w,]+\])?\s*([<>=~!]|["',\]]|$)/im;

function safeJson(text: string | null | undefined): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function parseManifests(files: Map<string, string | null>): ManifestFacts {
  const facts: ManifestFacts = {
    runtime: null,
    packageName: null,
    dependencies: [],
    hasBin: false,
    installScripts: [],
    keywords: [],
    hasMcpSdk: false,
    hasMcpServerManifest: false,
    hasMcpClientConfig: false,
    hasClaudePlugin: false,
    hasClaudeMarketplace: false,
    evidence: [],
  };

  const pkg = safeJson(files.get("package.json"));
  if (pkg && typeof pkg === "object") {
    facts.runtime = "node";
    facts.packageName = typeof pkg.name === "string" ? pkg.name : null;
    facts.hasBin = !!pkg.bin;
    const deps = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) });
    facts.dependencies = deps.slice(0, 60);
    facts.keywords = Array.isArray(pkg.keywords) ? pkg.keywords.map(String).slice(0, 20) : [];
    for (const s of ["preinstall", "install", "postinstall"]) {
      if (typeof pkg.scripts?.[s] === "string") {
        facts.installScripts.push({ name: s, command: pkg.scripts[s].slice(0, 200) });
      }
    }
    const sdk = deps.find((d) => NODE_MCP.includes(d));
    if (sdk) {
      facts.hasMcpSdk = true;
      facts.evidence.push(`package.json depends on ${sdk}`);
    }
  }

  const py = [files.get("pyproject.toml"), files.get("requirements.txt")].filter(Boolean).join("\n");
  if (py) {
    facts.runtime ??= "python";
    const name = files.get("pyproject.toml")?.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
    facts.packageName ??= name?.[1] ?? null;
    if (PY_MCP.test(py)) {
      facts.hasMcpSdk = true;
      facts.evidence.push("python dependency on mcp / fastmcp");
    }
  }

  if (files.get("server.json") || files.get("smithery.yaml")) {
    facts.hasMcpServerManifest = true;
    facts.evidence.push(files.get("server.json") ? "server.json (MCP registry manifest)" : "smithery.yaml");
  }
  if (files.has(".mcp.json")) facts.hasMcpClientConfig = true;
  if (files.get(".claude-plugin/plugin.json")) {
    facts.hasClaudePlugin = true;
    facts.evidence.push(".claude-plugin/plugin.json");
  }
  if (files.get(".claude-plugin/marketplace.json")) {
    facts.hasClaudeMarketplace = true;
    facts.evidence.push(".claude-plugin/marketplace.json");
  }

  return facts;
}
