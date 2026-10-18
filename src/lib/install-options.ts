export interface DocumentedInstallCommand { kind: string; command: string; source: string }

/** Present one documented entry point per installer; keep its flags and versions intact. */
export function installOptions(commands: DocumentedInstallCommand[]) {
  const readerCommands = commands.filter((c) => c.command.trim()
    && !/(?:^|\/)\.?(?:claude|agents)\/skills\/(?:release|publish)(?:\/|$)/i.test(c.source)
    && !/\b(?:twine\s+(?:upload|check)|npm\s+publish|pyproject-build)\b/i.test(c.command)
    && !/^\s*(?:uv\s+tool\s+install|pipx?\s+install|npm\s+(?:install|i))\s*(?:#.*)?$/.test(c.command));
  const readme = readerCommands.filter((c) => /(?:^|\/)readme(?:\.[a-z]+)?$/i.test(c.source));
  const candidates = readme.length ? readme : readerCommands;
  const kinds = new Set<string>();
  return candidates.filter((c) => {
    const kind = c.kind.toLowerCase();
    if (kinds.has(kind)) return false;
    kinds.add(kind);
    return true;
  });
}
