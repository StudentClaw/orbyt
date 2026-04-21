#!/usr/bin/env python3
"""
UserPromptSubmit hook: runs `graphify query` for architecture/codebase questions.
Skips implementation tasks (fix, add, implement, etc.) and non-arch questions.
"""
import sys, json, subprocess, os, re

ARCH_PATTERNS = [
    r'\barchitect\w*\b',
    r'\bcomponent\b', r'\bmodule\b', r'\bservice\b', r'\blayer\b',
    r'\bdata flow\b', r'\bcontrol flow\b',
    r'\brelationship\b', r'\bdependenc\w*\b',
    r'\boverview\b', r'\bstructure\b',
    r'\bhow does .{3,60} work\b',
    r'\bhow do .{3,60} work\b',
    r'\bwhat does .{3,60} do\b',
    r'\bexplain .{3,60}',
    r'\bwhere (is|are|does)\b',
    r'\bwhat (is|are) the .{3,50}',
    r'\bhow is .{3,60} (structured|organized|built|connected)\b',
]

# Skip if the message is clearly an implementation task
SKIP_PATTERNS = [
    r'\b(fix|debug|refactor|implement|add|create|write|update|change|rename|delete|remove)\b.{0,40}\b(code|function|file|component|class|method|bug|error|test)\b',
    r'^(fix|add|implement|create|update|change|rename|delete|remove)\b',
]

GRAPH_PATH = '/Users/rereynrd/School/student-claw/graphify-out/graph.json'


def is_arch_question(prompt: str) -> bool:
    text = prompt.strip()
    if any(re.search(p, text, re.IGNORECASE) for p in SKIP_PATTERNS):
        return False
    return any(re.search(p, text, re.IGNORECASE) for p in ARCH_PATTERNS)


def main():
    try:
        data = json.load(sys.stdin)
        prompt = data.get('prompt', '').strip()
    except Exception:
        sys.exit(0)

    if not prompt or not is_arch_question(prompt):
        sys.exit(0)

    if not os.path.isfile(GRAPH_PATH):
        sys.exit(0)

    try:
        project_root = '/Users/rereynrd/School/student-claw'
        result = subprocess.run(
            ['graphify', 'query', prompt, '--budget', '1500'],
            capture_output=True, text=True, timeout=20,
            cwd=project_root
        )
        if result.returncode == 0 and result.stdout.strip():
            out = {
                'hookSpecificOutput': {
                    'hookEventName': 'UserPromptSubmit',
                    'additionalContext': f'[graphify graph context]\n{result.stdout.strip()}'
                }
            }
            print(json.dumps(out))
    except Exception:
        pass


main()
