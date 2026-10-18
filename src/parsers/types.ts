/**
 * Shared parser output types. Everything described here is extracted from
 * repository files — none of it is generated or inferred by a model.
 */

export type InstallKind =
  | "claude-plugin" // /plugin install, claude plugin marketplace add
  | "claude-mcp" // claude mcp add
  | "skills-cli" // npx skills add
  | "manual-copy" // copy a folder into ~/.claude/skills
  | "npx"
  | "npm"
  | "uv"
  | "pipx"
  | "pip"
  | "brew"
  | "cargo"
  | "go"
  | "docker"
  | "git-clone"
  | "curl-pipe"
  | "mcp-config"; // a JSON block with "mcpServers"

export interface InstallCommand {
  kind: InstallKind;
  command: string;
  /** "readme" or the SKILL.md path the command was found in. */
  source: string;
}

export type RiskId =
  | "remote_script"
  | "unknown_binary"
  | "system_privilege"
  | "shell_exec"
  | "browser_control"
  | "file_rw"
  | "api_key_read"
  | "install_script";

export type RiskSeverity = "high" | "medium";

export interface RiskFlag {
  id: RiskId;
  /** Chinese label shown in the UI. */
  label: string;
  severity: RiskSeverity;
  /** File the match came from, e.g. "readme", "skills/pdf/SKILL.md". */
  source: string;
  /** The matched line, trimmed. Shown so a user can judge the risk themselves. */
  snippet: string;
}
