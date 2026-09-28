# RESUME — Phase 1 continuation, case-1-upload-and-recipients

A prior session started Phase 1 and was killed by a background-task timeout
partway through. Do not restart Phase 1 from scratch. Resume it.

## Orchestrator Contract — read first, applies for the whole session

You are the ORCHESTRATOR. You do not write code, you do not edit files, you
do not draft documents yourself. Every substantive step is delegated to an
`Agent` tool subagent. Reasoning effort: xhigh — state that explicitly in
every subagent brief. Stay interactive after dispatching. Zero tolerance for
unverified completion: no subagent reports DONE without its own evidence,
and you check the evidence before believing it.

## Already done — read these, do not regenerate

Workspace: `/Users/kuro/project/react/react-playground/signed-doc/docs/features/case-1-upload-and-recipients/`

- `prd-verify-report.md` — verdict READY, 2 documented deviations. Final.
- `QUESTIONS-ENGINEER.md` — final.
- `QUESTIONS-PM.md` — final.

## Still missing — this session's only job

Produce, in that same workspace:

1. `PLAN.md` — implementation plan, architecture, ADRs.
2. `TASK.md` — EPIC → Story → Subtask. Must yield **2–3 file-disjoint
   stories**, each ≥10 SP (1 SP = 30 min), so Phase 2 can run parallel mode.
3. `SCENARIO.md` — E2E scenarios (upstream Step 5 opt-in = yes).

Then **STOP**. Do not start Phase 2. Do not write feature code.

## Environment blockers — use these workarounds, do not re-diagnose

- Skill discovery is broken for this tree: `upstream`, `prd-intake`,
  `context-bundler`, `adr-planner`, `scenario-cataloguer`, `downstream` live
  at `~/.claude/skills/workflows/<name>/SKILL.md`, but Claude Code only
  discovers `~/.claude/skills/<name>/SKILL.md`. `Skill(upstream)` returns
  `Unknown skill: upstream`. Every subagent must read its `SKILL.md` by
  absolute path and follow it verbatim.
- `AskUserQuestion` may be absent. Every open decision is answered below, so
  no prompt should be needed.
- Keep each dispatched subagent's scope small enough to finish well inside
  10 minutes. Prefer three narrow subagents (one per output file, PLAN.md
  first since TASK.md and SCENARIO.md depend on it) over one long-running
  subagent that risks being killed again.

## Decisions — final, do not re-ask

- Feature title: `case-1-upload-and-recipients`.
- Namespace: `sign-doc`, mapped to the fixed enum as `sign-doc -> subproject-a`.
- PRD source: `/Users/kuro/project/react/react-playground/signed-doc/test_1_en.md`.
- Design source: `/Users/kuro/project/react/react-playground/signed-doc/Upload & Recipients Mockup.html`
  plus PRD §3. No Figma file exists — skip the Figma MCP pass entirely.
- Git: work in place in `signed-doc/`, on the existing branch
  `feat/case-1-upload-and-recipients` (already cut from `main`). **No
  worktree** — the git root is the parent `react-playground/`, which holds
  ~12 unrelated untracked projects. One commit per task, Conventional
  Commits.
- Stepper: render 3 steps with Step 3 ("Place fields") visibly
  locked/disabled. Display only — no routing, no fields UI, no scaffolding.
- Max upload size: 25 MB, enforced server-side, recorded as an assumption in
  `docs/decisions.md`.
- Storage: in-memory. File content discarded after validation; metadata kept.
- Deliverable docs stay at `signed-doc/`: `README.md`, `AGENTS.md`,
  `docs/decisions.md`, `docs/verification.md`.

## Feature spec

The full feature spec is at
`/Users/kuro/project/react/react-playground/signed-doc/docs/prompt.md`.
Have the PLAN.md subagent read it in full before drafting. Its Section 4
("Critical Facts") and Section 7 ("Success Criteria") are the binding
requirements; Section 5a maps each output item to its PRD requirement ID.
