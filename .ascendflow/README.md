# .ascendflow

Working directory for Ascend's Claude Code ecosystem. This is where plans, sessions, and reviews live. It is a living knowledge layer on top of the codebase that survives across sessions.

## Directory Layout

```
.ascendflow/
├── README.md         # This file
├── features/         # PRDs and task lists from /ax:plan
│   └── <slug>/
│       ├── PRD.md    # Product requirements, success criteria, affected layers
│       └── TASKS.md  # Dependency-ordered implementation tasks with file paths
├── sessions/         # Resumable session snapshots from /ax:save
│   └── <YYYY-MM-DD-HHMM>-<slug>.md
└── reviews/          # Review verdicts from /ax:review
    └── <YYYY-MM-DD-HHMM>-review.md
```

## Purpose

Claude sessions are ephemeral. Context windows fill up. Machines reboot. This directory makes Ascend development durable across those boundaries by writing the plan, state, and audit trail to disk.

## Who writes to this directory

- **`ax:plan`** writes `features/<slug>/PRD.md` and `features/<slug>/TASKS.md`.
- **`ax:save`** writes `sessions/<timestamp>-<slug>.md`.
- **`ax:review`** writes `reviews/<timestamp>-review.md`.
- **You** can write notes by hand if you want to leave a message for the next session.

## Who reads this directory

- The Ascend developer agent (`ascend-dev`) reads the feature PRD and task list when starting implementation on a planned feature.
- The Ascend reviewer agent (`ascend-reviewer`) reads the PRD to understand intent when auditing changes.
- A fresh Claude session resuming work reads the most recent session file first, then the files it references.
- You read it to remember what you were doing three days ago.

## Naming conventions

- **Feature slugs**: kebab-case, describing the feature in two or three words (`archive-goals`, `recurring-ui`, `notifications`).
- **Session filenames**: `<YYYY-MM-DD-HHMM>-<slug>.md`. Timestamp in Europe/Ljubljana.
- **Review filenames**: `<YYYY-MM-DD-HHMM>-review.md`.
- **Inside files**: European date format (D. M. YYYY) for human-readable dates. ISO-8601 only in filenames and machine fields.

## Lifecycle

- **Features** live until the feature is shipped, at which point you can optionally move the folder to an `archive/` subdirectory (not auto-created).
- **Sessions** accumulate indefinitely. Delete ones older than a month if the directory gets cluttered.
- **Reviews** accumulate indefinitely. They are a lightweight audit trail.

## Git

The `.ascendflow/` directory is tracked in git by default so the plan, history, and audit trail are part of the project. If you want to keep sessions local only, add `.ascendflow/sessions/` to `.gitignore`.

## Relationship to `.claude/`

- `.claude/` contains the Claude Code configuration: agents, skills, rules, settings. These are the capabilities.
- `.ascendflow/` contains the outputs and state. These are the artifacts.

Think of `.claude/` as the toolbox and `.ascendflow/` as the workshop.
