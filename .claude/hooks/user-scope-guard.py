#!/usr/bin/env python3
"""PreToolUse guard: work in this project does not install anything into GongJae's user-level configuration.

Before a Bash command that would write user-level Claude Code or package configuration, this asks GongJae instead of
letting it run: an MCP server added outside the project's `.mcp.json` (user scope, or local scope, the default, which
is kept in ~/.claude.json), a plugin installed without a project or local scope, a plugin marketplace added from the
command line, a global npm, pnpm, yarn, or bun install, and vendor setup wizards such as `rea-agents setup`,
`ctx7 setup`, `add-mcp -g`, and `neon init`, which register themselves for every project. The research projects
share that configuration. The pattern also matches such a command quoted inside another, as in `echo`, and then
asks all the same. Installing into the project itself is not affected.
"""
import json
import re
import sys

USER_WIDE = {
    "add an MCP server to ~/.claude.json": re.compile(
        r"\bclaude\s+mcp\s+add(-json)?\b(?![^;&|]*(--scope[=\s]+project\b|\s-s\s+project\b))"),
    "import MCP servers from Claude Desktop": re.compile(r"\bclaude\s+mcp\s+add-from-claude-desktop\b"),
    "add a plugin marketplace to the user settings": re.compile(r"\bclaude\s+plugins?\s+marketplace\s+add\b"),
    "install a plugin at user scope": re.compile(
        r"\bclaude\s+plugins?\s+install\b(?![^;&|]*(--scope[=\s]+(project|local)\b|\s-s\s+(project|local)\b))"),
    "install a package globally": re.compile(r"\b(npm|pnpm|bun)\s+(i|install|add|update|uninstall|remove)\b[^;&|]*"
                                             r"\s(-g|--global)\b|\byarn\s+global\s+add\b"),
    "run a setup wizard that registers itself for every project": re.compile(
        r"\brea-agents(@\S+)?\s+setup\b|\brea\s+(setup|update)\b|\bctx7\s+setup\b"
        r"|\badd-mcp\b[^;&|]*\s(-g|--global)\b|\bneon(@\S+)?\s+init\b"),
}

if __name__ == "__main__":
    command = json.load(sys.stdin).get("tool_input", {}).get("command", "")
    found = [label for label, pattern in USER_WIDE.items() if pattern.search(command)]
    if found:
        reason = (f"This command would {' and '.join(found)}, a change to GongJae's user-level configuration, which "
                  "the research projects share. Install into this project instead (.claude/settings.json, .mcp.json, "
                  "an agent's mcpServers, or a project dependency), or confirm that the user-wide change is wanted.")
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "ask",
                                                 "permissionDecisionReason": reason}}))
