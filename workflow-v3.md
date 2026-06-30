# The Vibecoding Workflow

## A Spec-First System for Shipping AI-Assisted Software

_Marcus Gao_
_Version 3.0 → living document (Cowork integration, May 2026)_
_Last updated: 2026-05-01_

> **Export note:** This is the living source. Export this file's content to each per-project Cowork knowledge base whenever it's updated. Also export to the Second Brain Maintainer Cowork project.

---

## 1. About This Document

This is the canonical reference for the vibecoding workflow — a seven-phase pipeline for building production-grade software with AI coding agents, designed for builders who want to ship real tools to real users.

**What changed in v3.0 (Cowork integration)**

- The project chat is replaced by Claude Cowork as the design/spec venue for Phases 0, 1, 2, 5b, 6, 7
- Cowork is a persistent-memory design agent, not a code agent — the two-agent discipline (Codex generates, Claude Code reviews) is unchanged
- One Cowork project per coding project — memory and attached files are per-build
- Phase 5b updated: Cowork drafts the reflection to `phase-5b-drafts/`; you review; wiki agent logs
- Three new verbatim trigger phrases govern Cowork interactions
- Standard project structure gains two new directories: `audit-reports/` and `phase-5b-drafts/`
- Cowork is explicitly forbidden from Phases 3, 4, and 5

**What changed in v2.1+ (training-app, Slices 1–5)**

- Phase 5b added — post-slice reflection pass: log what was built, capture workflow improvement candidates while fresh
- FUTURE_WORK.md added to standard project structure and post-slice sequence
- Quality review: named primitive install check (item 13); premise verification added to constraints
- Key Rules: future-work capture timing; pre-draft Phase 5 entries rule
- Schema discipline: project-specific rules belong in CLAUDE.md, not here

**Companion document:** Paired with the Vibecoding Setup Guide v2.0, which covers every tool install, Cowork project setup, and daily mechanics. Read this document first for the big picture.

---

## 2. The Mental Model

The workflow treats shipping software as a seven-phase pipeline where specification comes before code, version control runs in parallel with the build, features are built in small vertical slices with mandatory testing and documentation gates, and "done" only arrives when the tool has been delivered to its users with a manual and an announcement.

**Three AI agents, three non-overlapping roles:**

- **Codex** — drafts all code. Never reviews its own output.
- **Claude Code** — reviews, refines, debugs, runs post-slice automation. Never writes first-pass code.
- **Cowork** — designs, specs, audits. Never touches code or the build process.

**The seven phases at a glance**

| Phase | Name                            | Output                               | Owner               |
| ----- | ------------------------------- | ------------------------------------ | ------------------- |
| 0     | Discovery                       | 1-page project brief                 | Cowork              |
| 1     | Master Spec                     | Product definition                   | Cowork              |
| 2     | Architecture Plan               | How you will build it                | Cowork              |
| 3     | GitHub Repo & Environment Setup | Before any code                      | Claude Code         |
| 4     | Feature Slices                  | Build one at a time                  | Codex + Claude Code |
| 5     | Living Documentation            | Auto-maintained by Claude Code       | Claude Code         |
| 5b    | Post-Slice Reflection           | Cowork drafts; you review; wiki logs | Cowork → you → wiki |
| 6     | User Manual & Setup Guide       | After slices verified                | Cowork              |
| 6.5   | Pilot Test                      | One user, one full run-through       | You                 |
| 7     | Stakeholder Communication       | Announce to real users               | Cowork              |

**Phases 3, 4, 5 are untouchable by Cowork.** Cowork has zero presence in the build, review, or automation phases.

---

## 3. Five Guiding Principles

**1. Spec-first, always**
No implementation detail gets decided until the full specification is locked and confirmed. MASTER_SPEC.md, ARCHITECTURE.md, and every SLICE_N.md are the source of truth.

**2. Machine-readable output**
Every document is structured so an AI agent can parse it without ambiguity: numbered lists, explicit contracts, fenced code blocks.

**3. Slice by feature**
Break the build into self-contained vertical slices. Every slice is independently testable, independently committable, and independently rollback-able.

**4. GitHub runs in parallel**
The repo is created before any code is written. Every verified slice gets committed before the next one starts.

**5. Ship completely**
The project is not done when the code works. It is done when the tool has been delivered with a user manual, survived a pilot test, and been announced to its intended users.

---

## 4. The Three-Agent Discipline

| Agent           | Job                                       | When to use                                 | Forbidden                                |
| --------------- | ----------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| **Cowork**      | Designs, specs, audits — the design venue | Phases 0, 1, 2, 5b, 6, 7                    | Touching code; Phases 3, 4, 5; AGENTS.md |
| **Codex**       | Generates the first draft of new code     | Only when starting a new slice from scratch | Reviewing own output; debugging          |
| **Claude Code** | Reviews, refines, debugs, automates       | After every Codex run; post-slice sequence  | Writing first-pass code from scratch     |

The rule is strict: Codex drafts but never reviews its own work; Claude Code reviews every draft and never writes first drafts; Cowork designs and never generates or reviews code.

**Why Cowork is separate from the build**
Cowork's persistent memory is optimized for design arc continuity — knowing which decisions were made when, which KIs are open, which patterns have been established. That memory is a liability in the build phase, where precise code review and surgical debugging require fresh, unanchored judgment. Cowork entering Phases 3–5 would muddy both its design memory and the review discipline simultaneously.

**Parallel project-root config files**

- `CLAUDE.md` — read by Claude Code. Rules for debugging, commits, living documentation, schema discipline.
- `AGENTS.md` — read by Codex. Rules for scope, allowlists, no-invented-schema, no-TODOs, assumptions list.

**One Cowork project per coding project**
Memory, attached files, and audit state are per-build. Do not umbrella multiple apps into one Cowork project.

---

## 5. What You Do vs What Each Agent Does

| Task                                                      | You | Cowork | Claude Code | Note                                                       |
| --------------------------------------------------------- | --- | ------ | ----------- | ---------------------------------------------------------- |
| Answer Discovery questions                                | ✓   |        |             | Phase 0                                                    |
| Draft PROJECT_BRIEF, MASTER_SPEC, ARCHITECTURE            |     | ✓      |             | You review and confirm                                     |
| Paste confirmed spec docs into the project folder         |     |        | ✓           | Paste content; Claude Code writes to /spec/                |
| Create the GitHub repo on github.com                      | ✓   |        |             | Requires web login                                         |
| Write .gitignore, CLAUDE.md, AGENTS.md, .env.example      |     |        | ✓           | From standard templates                                    |
| First commit + push                                       |     |        | ✓           | Claude Code runs git commands                              |
| Draft slice documents (SLICE_N.md)                        |     | ✓      |             | You review; Claude Code saves to /spec/slices/             |
| Save slice doc to /spec/slices/ BEFORE build              |     |        | ✓           | Happens at start of the slice                              |
| Pre-slice readiness check                                 |     | ✓      |             | Triggered by "Starting design for Slice N"                 |
| Copy Codex prompt → run in Codex app                      | ✓   |        |             | Switch to Codex desktop window                             |
| Review Codex output for schema drift                      | ✓   |        | ✓           | Claude Code flags; you confirm                             |
| Approve / reject Codex diffs                              | ✓   |        |             | Per-file confirmation in Codex UI                          |
| Run Claude Code quality review pass on Codex output       | ✓   |        | ✓           | MANDATORY every slice                                      |
| Copy errors / failures → Claude Code                      | ✓   |        |             | Manual copy-paste                                          |
| Run the user flow to verify the slice                     | ✓   |        |             | Definition of "verified"                                   |
| Declare slice verified to Claude Code                     | ✓   |        |             | "Slice N verified — run the post-slice sequence"           |
| Update CHANGELOG / DECISIONS / KNOWN_ISSUES / FUTURE_WORK |     |        | ✓           | Triggered by the "slice verified" command                  |
| Run pip freeze / lock dependencies                        |     |        | ✓           | Part of the post-slice sequence                            |
| Commit and push                                           |     |        | ✓           | Part of the post-slice sequence                            |
| Draft Phase 5b reflection                                 |     | ✓      |             | Triggered by "Slice N complete, draft Phase 5b reflection" |
| Review + finalize Phase 5b reflection                     | ✓   |        |             | You accept/edit Cowork's draft; wiki agent logs            |
| Pilot-test with one user                                  | ✓   |        |             | Phase 6.5                                                  |
| Draft user manual (.docx)                                 |     | ✓      |             | You review; Claude Code saves to repo                      |
| Draft stakeholder messages                                |     | ✓      |             | Two versions per Phase 7                                   |
| Send the announcement                                     | ✓   |        |             | Your call on timing and channel                            |

### 5.5 Verbatim Trigger Phrases

These three phrases are the handoff signals. Use them verbatim — no paraphrasing.

| Phrase                                             | Sent to     | Triggers                                            |
| -------------------------------------------------- | ----------- | --------------------------------------------------- |
| `"Starting design for Slice N"`                    | Cowork      | Pre-slice readiness check, then Phase 0 Q&A         |
| `"Slice N verified — run the post-slice sequence"` | Claude Code | CHANGELOG, DECISIONS, KI, FUTURE_WORK, commit, push |
| `"Slice N complete, draft Phase 5b reflection"`    | Cowork      | Draft to phase-5b-drafts/SLICE_N-reflection.md      |

**Cowork's pre-slice readiness check** (triggered by "Starting design for Slice N"):
Before any Phase 0 Q&A, Cowork surfaces open 🟡 Medium KIs that have been open 2+ slices, FUTURE_WORK candidates that may fold into scope, any rough scope idea that contradicts a DECISIONS.md entry, and whether the previous slice's post-slice sequence completed. Readiness report comes first; Marcus accepts/rejects each flag; then Phase 0 begins.

---

## 6. Standard Project Folder Structure

```
project-name/
├── .gitignore
├── .env.example
├── CLAUDE.md
├── AGENTS.md
├── README.md
├── CHANGELOG.md
├── DECISIONS.md
├── KNOWN_ISSUES.md
├── FUTURE_WORK.md             # created on first need
├── requirements.txt           # or package.json
│
├── spec/
│   ├── PROJECT_BRIEF.md
│   ├── MASTER_SPEC.md
│   ├── ARCHITECTURE.md
│   └── slices/
│       └── SLICE_N_NAME.md
│
├── audit-reports/             # Cowork writes here (weekly audits)
├── phase-5b-drafts/           # Cowork writes here (post-slice reflections)
│
├── app/ or src/
├── tests/
└── Manual_ProjectName.docx
```

**Write zone discipline:** Cowork may only write to `spec/slices/`, `audit-reports/`, `phase-5b-drafts/`, and (with explicit approval) `CLAUDE.md` and `spec/MASTER_SPEC.md`. All source code directories, CHANGELOG.md, DECISIONS.md, KNOWN_ISSUES.md, FUTURE_WORK.md, and AGENTS.md are Claude Code territory — Cowork never touches them.

---

## 7. Phase 0 — Discovery

**Owner: Cowork**

Convert a vague idea into a one-page Project Brief. Trigger: `"Starting design for Slice 1"` (or for the initial project brief, start with a session opener in Cowork).

**Five questions, asked one at a time:**

1. What problem does this solve? Who uses it?
2. What does "done" look like?
3. What tech is already decided, if any?
4. Any hard constraints — deadline, budget, integrations?
5. Anything already started?

**Output:** PROJECT_BRIEF.md — 1 page max, saved in /spec/. Cowork produces the markdown and instructs you to paste it into Claude Code to save.

---

## 8. Phase 1 — Master Spec

**Owner: Cowork**

Turn the brief into a complete, unambiguous product definition.

**Ten mandatory sections:**

1. Problem Statement (2–3 sentences)
2. Target Users
3. User Stories — "As a [user], I want [action] so that [outcome]"
4. Feature List, grouped P0 / P1 / P2
5. Screens / Pages / Flows
6. Data Model (entities, fields, relationships)
7. External Integrations
8. Non-Functional Requirements
9. Out of Scope
10. Open Questions

**Cowork discipline during spec writing:** Before writing any section, Cowork identifies which DECISIONS.md entries and ARCHITECTURE.md sections constrain that section and quotes them. Section 4 (Contracts) gets the heaviest check — column names, API shapes, schema references must echo what's locked.

**Output:** MASTER_SPEC.md in /spec/. Confirmed section by section before moving to Phase 2.

---

## 9. Phase 2 — Architecture Plan

**Owner: Cowork**

Decide how you will build what the spec describes.

**Seven mandatory sections:**

1. Tech Stack Decision with rationale
2. File/Folder Structure (full directory tree)
3. Module Map (one responsibility per module)
4. API Contract (every route: method, request shape, response shape)
5. State Management
6. Auth Flow (step by step)
7. Key Dependencies

**Output:** ARCHITECTURE.md in /spec/.

**Project-specific schema rules** (migration immutability, ORM behavior, seed idempotency, etc.) belong in the project's CLAUDE.md — not here, not in Cowork's memory.

---

## 10. Phase 3 — GitHub Repo & Environment Setup

**Owner: Claude Code**

Do this before writing a single line of code. Cowork has no role here.

**Eight steps:**

1. Create the empty repo on github.com
2. Clone the empty repo locally and cd into it
3. Open the folder in VS Code
4. Open Claude Code in VS Code terminal; open Codex desktop separately pointed at the same folder
5. Paste in .gitignore, CLAUDE.md, AGENTS.md (Claude Code writes each file)
6. Paste in /spec/PROJECT_BRIEF, MASTER_SPEC, ARCHITECTURE
7. Paste in .env.example with every env var the app will use
8. First commit and push after Slice 1 is verified

**Set up Cowork project for this build** (new step — see Setup Guide Part 2): After Phase 3 environment setup, create the Cowork project pointed at this folder, attach the living docs, paste the standard instructions, and run the calibration task. This is a one-time step per project.

**Dependency lock policy:**

- Python: `pip freeze > requirements.txt` at the end of every slice
- Node.js: commit package-lock.json; pin versions in package.json

---

## 11. Phase 4 — Feature Slices

**Owner: Codex (generates) + Claude Code (reviews)**
**Cowork: forbidden from this phase**

Build the app one feature at a time, testing and committing each before starting the next.

**Anatomy of a slice document** — each slice gets its own /spec/slices/SLICE_N_NAME.md:

1. Goal (one sentence)
2. Acceptance Criteria (numbered, testable)
3. Files to Create or Modify
4. Component/Function Contracts
5. Edge Cases to Handle
6. Test Cases
7. Codex Generation Prompt
8. Claude Code Quality Review Prompt
9. Claude Code Debugging Prompt

**The slice execution order (9 steps):**

| #     | Step                                            | Where                                                                                                           |
| ----- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1     | Generate slice doc in Cowork                    | Say "Starting design for Slice N" — readiness check first, then Phase 0 Q&A, then Cowork drafts full SLICE_N.md |
| 2     | Save slice doc to /spec/slices/ BEFORE building | Claude Code saves it                                                                                            |
| 3     | Copy Codex prompt → run in Codex app            | Switch to Codex desktop window                                                                                  |
| 4     | Review diffs, accept or reject                  | Fast human pass                                                                                                 |
| **5** | **Claude Code quality review pass (MANDATORY)** | Paste the Quality Review Prompt; happens before tests                                                           |
| 6     | Run the user flow, test all acceptance criteria | End-to-end                                                                                                      |
| 7     | Debug with Claude Code (only if tests fail)     | Iterate 6 ↔ 7 until all criteria pass                                                                          |
| 8     | Declare slice verified to Claude Code           | "Slice N verified — run the post-slice sequence"                                                                |
| 9     | Move on                                         | Back to Cowork for next slice                                                                                   |

**The quality review step — what Claude Code fixes directly:**

- Naming that drifts from ARCHITECTURE.md conventions
- Missing error handling on network, I/O, or parsing calls
- Duplicated logic that should be extracted
- Dead code, unused imports, commented-out blocks
- Obvious inefficiencies
- Placeholder comments, stub functions, TODO notes
- Missing entries in .env.example for new environment variables
- **Explicit install commands in the slice spec** — verify they ran; do not accept hand-rolled equivalents

**What Claude Code flags but does not change without approval:**

- Structural changes affecting more than one file
- Refactors that alter the API contract or folder structure
- Subjective style preferences when existing code is acceptable

**Premise discipline:** Before acting on any flagged issue, verify the premise. If the fix requires modifying a file outside the slice's allowlist, that's a signal to re-examine the premise, not override the constraint. This applies to both Claude Code (build) and Cowork (design).

**Definition of Ready:**

- [ ] Slice document written, reviewed, AND saved to /spec/slices/
- [ ] Previous slice committed, verified, and pushed
- [ ] Open questions blocking this slice resolved
- [ ] Required env vars present and verified
- [ ] If slice touches database: live schema confirmed and copied into Codex prompt
- [ ] Dependencies from prior slices pass their tests

**Definition of Verified:**

- [ ] Claude Code quality review pass complete; every flagged item fixed or consciously accepted
- [ ] All acceptance criteria pass their tests
- [ ] Full user flow runs end-to-end manually
- [ ] Diff review confirms: no placeholder TODOs, no files modified outside allowlist
- [ ] If slice touches database: every column name matches live schema

**The "slice verified" handoff:**

```
Slice N is verified. Run the post-slice sequence.
```

Triggers Claude Code automation: update CHANGELOG, DECISIONS, KNOWN_ISSUES, FUTURE_WORK; re-lock dependencies; commit; push.

**Key rule — future-work capture timing:** Items that belong in FUTURE_WORK.md should be captured during testing (Step 6) — before the post-slice sequence runs — so they can roll into the single post-slice commit.

**Key rule — pre-draft Phase 5 entries when verification surfaces new findings:** If testing reveals anything beyond the slice spec — a downgraded KI, corrected attribution, deferred AC — draft the exact CHANGELOG / DECISIONS / KNOWN_ISSUES wording in Cowork _before_ triggering the post-slice sequence. Bundle the pre-drafted entries with the "slice verified" handoff. Cowork owns _what_ gets logged; Claude Code owns _that it gets logged_.

**Schema drift — the most common silent failure:** Codex frequently invents column names that don't match the actual schema. Paste the live schema into every Codex prompt that touches the data layer, and require Codex to echo back the column names it is using.

---

## 12. Phase 5 — Living Documentation

**Owner: Claude Code**

Four files maintained automatically throughout the build:

**CHANGELOG.md** — running log of what was built, by slice. Each entry names the slice, summarizes what was built, lists deviations from spec, and logs bugs caught.

**DECISIONS.md** — architecture decision log. Every non-trivial technical choice gets an entry with options considered and reasoning. Cowork may draft proposed decision entries during Phase 0/1/2 in chat; Claude Code's post-slice automation adds the final entries.

**KNOWN_ISSUES.md** — honest bug list: 🔴 Critical / 🟡 Medium / 🟢 Low. Cowork's pre-slice readiness check surfaces 🟡 Medium issues open 2+ slices as scope candidates.

**FUTURE_WORK.md** — deliberate future product and methodology work. Two sections: Methodology/Product Improvements and Workflow Improvement Candidates. Candidates feed the next revision of this document at project completion.

---

## 12b. Phase 5b — Post-Slice Reflection

**Owner: Cowork (drafts) → You (review) → Wiki agent (logs)**

After the post-slice sequence completes:

1. Say to Cowork: `"Slice N complete, draft Phase 5b reflection"`
2. Cowork reads the just-completed CHANGELOG entry, recent KI changes, DECISIONS additions, FUTURE_WORK additions and drafts to `phase-5b-drafts/SLICE_N-reflection.md`
3. You review the draft, accept or edit
4. Bring the accepted version to the wiki agent for logging in the second brain

**What the reflection covers:**

- What was built (brief)
- Any workflow friction, surprising agent behavior, or rules established mid-slice
- Items that belong in FUTURE_WORK.md (if not already captured during Step 6)
- Candidate workflow improvements (numbered in the existing series)
- Whether any candidate is mature enough to propose for adoption in this document

**Cross-Cowork handoff:** If Marcus accepts a candidate for methodology adoption → drop into `second_brain/inbox/` → Wiki Cowork drafts the workflow-v3.md update overnight → wiki agent (Claude Code) finalizes.

---

## 13. Phase 6 — User Manual & Setup Guide

**Owner: Cowork**

Write a document that a non-developer can follow to install, launch, and use the tool without your help.

**Ten mandatory sections:**

1. What This Tool Does
2. What You Need Before Starting
3. Installation
4. Launching the Tool
5. Using the Tool Step by Step
6. Understanding the Output
7. Troubleshooting
8. Important Notes
9. Getting Updates
10. Questions & Support

**Output:** A polished .docx file named `Manual_ProjectName.docx`, committed to the repo.

---

## 14. Phase 6.5 — Pilot Test

Before the broader announcement, hand the manual and the tool to one person and watch them use it.

1. Pick one representative user
2. Give them only the GitHub link and the manual — no verbal instructions
3. Be available but do not volunteer help
4. Have them run through the full install and use flow while you take notes
5. Log every point of confusion, error, or workaround in KNOWN_ISSUES.md

---

## 15. Phase 7 — Stakeholder Communication

**Owner: Cowork**

Announce the tool to its users. Every message includes: what the tool does (plain English), key features, GitHub repo link, manual location, setup time estimate, important caveats, who to contact.

Always produce two versions: formal (PIs, clients, external collaborators) and casual (lab mates, teammates).

---

## 16. Final Handoff Checklist

**Code:**

- [ ] All slices built and verified
- [ ] No 🔴 Critical issues in KNOWN_ISSUES.md unresolved
- [ ] Final commit pushed

**Repository:**

- [ ] No output/, logs/, or tmp\_\* folders in repo
- [ ] No test*slice*\*.py files in repo
- [ ] .env not in repo; .env.example is current
- [ ] README.md accurate and current
- [ ] User manual committed
- [ ] CLAUDE.md and AGENTS.md committed and current

**Documentation:**

- [ ] CHANGELOG.md complete through final slice
- [ ] KNOWN_ISSUES.md current
- [ ] DECISIONS.md complete
- [ ] FUTURE_WORK.md — Workflow Improvement Candidates reviewed and consolidated into proposed v3.x revision
- [ ] MASTER_SPEC.md and ARCHITECTURE.md reflect final state

**Pilot + communication:**

- [ ] Pilot test completed and findings incorporated
- [ ] Announcement message sent

---

## Appendix A — Standard Project Structure

```
project-name/
├── .gitignore
├── .env.example
├── CLAUDE.md
├── AGENTS.md
├── README.md
├── CHANGELOG.md
├── DECISIONS.md
├── KNOWN_ISSUES.md
├── FUTURE_WORK.md
├── requirements.txt           # or package.json
├── spec/
│   ├── PROJECT_BRIEF.md
│   ├── MASTER_SPEC.md
│   ├── ARCHITECTURE.md
│   └── slices/
│       └── SLICE_N_NAME.md
├── audit-reports/             # Cowork writes here
├── phase-5b-drafts/           # Cowork writes here
├── app/ or src/
├── tests/
└── Manual_ProjectName.docx
```

---

## Appendix B — .gitignore Template

```
output/
logs/
tmp_logs/
tmp_output/
__pycache__/
*.pyc
*.pyo
node_modules/
.next/
dist/
build/
.env
.env.local
venv/
.DS_Store
Thumbs.db
.claude/
test_slice_*.py
```

---

## Appendix C — CLAUDE.md Template

```markdown
# CLAUDE.md — Instructions for Claude Code on this project

## Project

[PROJECT_NAME] — [1-2 sentence description]

## My role

I am Claude Code — reviewer, editor, and debugger. I do NOT write new feature
slices from scratch; that is Codex's job. Cowork handles design and spec; I
handle build and review.

If asked to generate an entirely new slice from nothing, I pause and ask the
user to have Codex draft it first.

## The quality review pass (mandatory after every Codex generation)

1. Read every file Codex created or modified
2. Check and fix directly:
   - Naming conventions match /spec/ARCHITECTURE.md
   - Single clear responsibility per file
   - No duplicated logic
   - Error handling on every external call, file I/O, network request
   - No dead code, unused imports, commented-out blocks
   - No placeholder TODOs or stub functions
   - Schema fidelity — every column reference matches live schema
   - .env.example current with new env vars
   - Explicit install commands in slice spec ran — no hand-rolled equivalents
3. Flag but do not change without approval:
   - Structural changes affecting more than one file
   - Refactors that alter API contract or folder structure
   - Subjective style preferences when existing code is acceptable
   - Any flagged issue where the fix requires a file outside the slice's allowlist
     (verify premise first)

## Folder structure

- /spec/ — MASTER_SPEC.md, ARCHITECTURE.md, PROJECT_BRIEF.md, slices/
- Root — CHANGELOG.md, DECISIONS.md, KNOWN_ISSUES.md, FUTURE_WORK.md, CLAUDE.md, AGENTS.md
- /app/ (or /src/) — source code
- /tests/ — automated tests
- /audit-reports/ — Cowork writes here; I do not modify
- /phase-5b-drafts/ — Cowork writes here; I do not modify

## The post-slice sequence

When the user says "Slice N verified — run the post-slice sequence":

1. Update CHANGELOG.md under a new Slice N heading
2. Update DECISIONS.md if any architectural choice was made
3. Update KNOWN_ISSUES.md if any bug was found or limitation introduced
4. Update FUTURE_WORK.md if future work items surfaced during testing
5. Re-lock dependencies (pip freeze or verify package-lock.json)
6. Stage and commit: `Slice N complete — [brief description]`
7. Push to origin/main
8. Confirm to user what was committed

Do NOT run unless the user has explicitly said the slice is verified.

## Definition of "verified"

All of the following must be true:

- Quality review pass complete; every flagged item fixed or consciously accepted
- All acceptance criteria in SLICE_N.md pass
- Full user flow runs end-to-end without errors
- Diff confirms no placeholder TODOs; no files modified outside allowlist
- If database-touching: every column name matches live schema

## Schema discipline

[Add project-specific schema rules here — migration immutability, ORM behavior,
seed idempotency. These belong here, not in the workflow doc.]

## Environment variables

- Maintain .env.example with every variable the app uses
- Verify active value before running: `echo $VAR_NAME`
- Never commit .env

## Rollback protocol

- Use `git revert <commit-hash>` (never `git reset --hard` on shared history)
- Log in KNOWN_ISSUES.md

## Files never to commit

- output/, logs/, tmp_logs/, tmp_output/
- .env
- test*slice*\*.py
- .DS_Store, .claude/, **pycache**/, node_modules/, .next/

## Write zone rule

audit-reports/ and phase-5b-drafts/ are Cowork's write zones.
I read them for context; I do not write to them.
```

---

## Appendix D — Codex Generation Prompt Template

```
CONTEXT:
[App description, tech stack, current repo state — 2-3 sentences. Include
 the current live database schema if this slice touches the data layer.]

TASK:
[Exactly what to build in this slice]

FILES TO CREATE:
[Explicit list with the purpose of each file]

CONSTRAINTS:
- [Framework rules]
- [Naming conventions from ARCHITECTURE.md]
- [Security / performance requirements]
- [If data layer: use these exact column names: ...]

ACCEPTANCE CRITERIA:
1. [Criterion 1]
2. [Criterion 2]

DO NOT:
- Modify files outside the list above
- Add features outside this slice's scope
- Leave placeholder comments or TODOs
- Invent database column names — use only the schema provided

OUTPUT:
Write the complete implementation. Do not explain — just produce the code.
At the end, list every assumption made and every column name / env var /
API endpoint referenced, so it can be verified against the schema.
```

---

## Appendix E — Claude Code Quality Review Prompt Template

```
CONTEXT:
[App description and the slice Codex just generated.]

TASK:
Quality review pass on Codex output. Do NOT add features or change
functionality. Surgical improvements to production quality only.

CHECK AND FIX DIRECTLY:
1.  Naming — matches ARCHITECTURE.md conventions
2.  Structure — single clear responsibility per file
3.  Duplication — extract repeated logic into shared helpers
4.  Error handling — every external call, file I/O, network request
5.  Dead code — remove unused imports, unreachable branches, commented-out blocks
6.  Readability — clear names, reasonable function length
7.  Type safety (if TypeScript or typed Python)
8.  Performance — obvious inefficiencies
9.  Schema fidelity — every DB column/field reference matches live schema
10. Scope — no files outside allowlist; no features beyond acceptance criteria
11. Placeholders — remove all TODOs, stubs, "replace with real implementation" notes
12. Environment variables — add new env vars to .env.example
13. Install commands — if slice spec listed explicit install commands, verify
    they ran; do not accept hand-rolled equivalents

FLAG BUT DO NOT CHANGE WITHOUT APPROVAL:
- Structural changes affecting more than one file
- API contract changes
- Folder structure changes
- Subjective style preferences when existing code is acceptable

CONSTRAINTS:
- Do not add features or change functionality
- Minimal, surgical changes
- Before flagging any issue, verify the premise. If fixing requires a file
  outside the allowlist, re-examine the premise — not the constraint.

OUTPUT:
1. Files modified with one-line description each
2. Flagged items awaiting decision
3. Schema drift detected
4. Ready-for-testing verdict (yes / no — if no, what's blocking)
```

---

## Appendix F — Claude Code Debugging Prompt Template

```
CONTEXT:
[App description and the slice just generated and reviewed]

CURRENT PROBLEM:
[Exact error message, screenshot transcription, or description of failure]

RELEVANT FILES:
[List of files involved]

WHAT THE CODE CURRENTLY DOES:
[Brief summary — what's working, what's broken]

CONSTRAINTS:
- Do not refactor outside the current problem
- [Tech stack and style rules]

ACCEPTANCE CRITERIA:
1. [Criterion 1]
2. [Criterion 2]

DO NOT:
- Rewrite files that are currently working
- Add features outside the current fix
- Change folder structure from ARCHITECTURE.md
- Generate a new slice from scratch — stop and tell me to take it to Codex

OUTPUT:
Fix the problem. Summarize what changed, why, and list follow-up issues.
```

---

## Appendix G — Git Command Reference

| Action                       | Command                                  |
| ---------------------------- | ---------------------------------------- |
| Check what will be committed | `git status`                             |
| Stage all changes            | `git add .`                              |
| Commit                       | `git commit -m "Slice N complete — ..."` |
| Push to GitHub               | `git push`                               |
| Remove file from tracking    | `git rm --cached filename`               |
| Pull the latest              | `git pull`                               |
| View commit history          | `git log --oneline`                      |
| Revert a committed slice     | `git revert <commit-hash>`               |

---

## Version History

- **v3.0 (May 2026):** Cowork integration. Project chat replaced by Cowork for Phases 0, 1, 2, 5b, 6, 7. Three-agent discipline codified (Cowork/Codex/Claude Code). Three verbatim trigger phrases added. Phase 5b updated: Cowork drafts to phase-5b-drafts/. Standard project structure gains audit-reports/ and phase-5b-drafts/. CLAUDE.md template updated with write zone rule. One-Cowork-project-per-build rule established.
- **v2.1+ living (May 2026):** Phase 5b added; FUTURE_WORK.md added; quality review item 13 (named primitive installs); premise discipline; future-work capture timing; pre-draft Phase 5 entries rule; schema discipline note
- **v2.1 (April 2026):** Mandatory quality review pass; 9-step slice loop; Section 5.5 (manual action prompting); formalized "slice verified" handoff; Appendix E (quality review prompt)
- **v2.0:** Living documentation auto-maintained by Claude Code
- **v1.x:** Manual documentation maintenance
