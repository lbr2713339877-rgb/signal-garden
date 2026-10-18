import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installOptions } from './install-options';

test('installation options preserve the platform command and exclude maintainer release tooling', () => {
  const commands = [
    { kind: 'uv', source: 'readme', command: 'uv tool install --python 3.13 "example[all]==2.0"' },
    { kind: 'claude-mcp', source: 'readme', command: 'claude mcp add -s user example -- uvx example' },
    { kind: 'uv', source: 'readme', command: 'uvx example' },
    { kind: 'uv', source: 'readme', command: 'uv tool install' },
    { kind: 'uv', source: '.claude/skills/release/SKILL.md', command: 'uvx --from twine twine upload dist/*' },
    { kind: 'pip', source: '.claude/skills/release/SKILL.md', command: 'pip install -U packaging' },
  ];
  assert.deepEqual(installOptions(commands).map((c) => c.command), [commands[0].command, commands[1].command]);
});

test('a skill-only documented install remains available when there is no README command', () => {
  const c = { kind: 'npm', source: 'SKILL.md', command: 'npm install example@3' };
  assert.deepEqual(installOptions([c]), [c]);
});
