const opencodeToClaudeCode = {
  bash: "Bash",
  edit: "Edit",
  read: "Read",
  glob: "Glob",
  grep: "Grep",
  write: "Write",
  task: "Agent",
  todowrite: "TodoWrite",
  webfetch: "WebFetch",
  skill: "Skill",
  question: "AskUserQuestion",
} as const

const claudeCodeToOpencode = Object.fromEntries(
  Object.entries(opencodeToClaudeCode).map(([opencode, claudeCode]) => [claudeCode, opencode]),
) as Record<string, string>

export function claudeCodeToolName(name: string): string {
  return opencodeToClaudeCode[name as keyof typeof opencodeToClaudeCode] ?? name
}

export function opencodeToolName(name: string): string {
  return claudeCodeToOpencode[name] ?? name
}
