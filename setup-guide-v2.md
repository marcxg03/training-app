# The Vibecoding Setup Guide

## From a Blank Laptop to Your First Committed Slice

_Marcus Gao_
_Version 2.0 — Cowork integration_
_Last updated: 2026-05-01_

> **Export note:** This is the living source. This file and `workflow-v3.md` are the canonical pair. Export both to each Cowork project's knowledge base whenever either is updated, replacing the prior versions. Cowork projects are per-coding-project — both docs go into each one.

---

## Welcome

This guide takes you from a blank laptop to your first committed feature slice. It covers every tool you need to install, every account you need to create, every connection you need to configure, and every manual action you will take during a typical build.

Every command in this guide is copy-paste-ready. Every step tells you how to verify it worked before moving on. When something can break, the common failures are called out inline.

**What this guide pairs with:** This is the companion to the Vibecoding Workflow document. That document explains the seven-phase methodology — what you build, in what order, and why. This document explains the mechanics — how to actually install and drive the tools. Read the Workflow document first, then use this guide when you are ready to set up.

**What changed in v2:** The stateless Claude Project chat has been replaced by a per-project Cowork project. Each new coding app gets its own Cowork project. Part 2 covers the one-time Cowork access setup; Part 3's spin-up steps include Cowork project creation.

---

## What You Will Install

| Tool                | What it does                                      | Required?                   |
| ------------------- | ------------------------------------------------- | --------------------------- |
| Terminal            | Text interface to machine                         | Required — built in         |
| Homebrew (Mac only) | Mac package manager                               | Required on Mac             |
| Git                 | Version control                                   | Required                    |
| Node.js + npm       | JS runtime; required by Codex CLI                 | Required                    |
| Python 3            | Language for lab tools (Streamlit, scripts)       | Required for lab tools      |
| VS Code             | Code editor; Claude Code runs here                | Required                    |
| GitHub account      | Cloud repo host                                   | Required                    |
| Claude Code         | AI editor and debugger; runs in terminal          | Claude Pro: $20/month       |
| Claude Cowork       | Persistent design/spec agent; one project per app | Claude Pro Max: ~$100/month |
| Codex desktop app   | AI code generator; runs in own window             | ChatGPT Plus: $20/month     |
| GitHub Desktop      | Visual Git UI                                     | Optional                    |

**Total recurring cost:** ~$120/month (Claude Pro Max + ChatGPT Plus). Claude Pro ($20/month) covers Claude Code but not Cowork scheduled tasks — Max tier is required for unattended scheduled audits.

---

## Part 1 — One-Time Machine Setup

Do everything in Part 1 once per computer. If you already have some of these installed, run the verification command for each step and skip if it works.

### 1.1 Open your terminal

**Mac:** Press Cmd + Space → type "Terminal" → press Enter.  
**Windows:** Press Windows key → type "PowerShell" → press Enter.

**Verify:** `echo "hello"` → should print `hello`.

### 1.2 Install Homebrew (Mac only)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Enter your Mac login password when prompted (it won't appear as you type). Takes 5–15 minutes.

**Verify:** `brew --version` → should print `Homebrew 4.x.x`

If it returns "command not found" after install, scroll up in your terminal — the installer printed two commands at the end that add Homebrew to your PATH. Copy-paste them.

### 1.3 Install Git

**Check first:** `git --version` — if you see a version number, skip to 1.4.

**Mac:** `brew install git`  
**Windows:** Download from git-scm.com/download/win, accept all defaults.

**Verify:** `git --version` → `git version 2.x.x` or higher.

### 1.4 Configure Git with your identity

Run once. Use the email you'll use for your GitHub account:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
```

**Verify:** `git config --global user.name` and `git config --global user.email` — both should print what you just set.

### 1.5 Install Node.js and npm

**Mac:** `brew install node`  
**Windows:** Download from nodejs.org (LTS version), accept all defaults.

**Verify:** `node --version` (must be v20+) and `npm --version`

**Avoid sudo for global installs (Mac):**

```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
```

### 1.6 Install Python 3

**Check first:** `python3 --version` — you need 3.10 or higher.

**Mac:** `brew install python@3.12`  
**Windows:** Download from python.org/downloads. Check "Add Python to PATH" during install — easy to miss.

**Verify:** `python3 --version` and `pip3 --version`

### 1.7 Install VS Code

Download from code.visualstudio.com and run the installer.

**Mac terminal integration (optional but recommended):**

1. Open VS Code
2. Press Cmd + Shift + P
3. Type "Shell Command: Install 'code' command in PATH" and press Enter

**Verify:** `code --version`

**Recommended extensions:** Python (Microsoft), Pylance (Microsoft), ESLint, Prettier, GitLens.

### 1.8 Create your GitHub account

Go to github.com and sign up. Use the same email as step 1.4. Pick a professional username — it appears in every repo URL you'll share.

### 1.9 Connect Git to GitHub (Personal Access Token)

1. github.com → profile picture → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)
2. Name it "Vibecoding workflow token"
3. Set expiration to 1 year
4. Check the `repo` scope
5. Click Generate token — **copy it immediately, it's shown once only**

The first time you `git push`, enter your GitHub username and paste the token as the password. Mac Keychain saves it so you only enter it once.

### 1.10 Sign up for Claude Pro Max

Go to claude.ai → sign up → Settings → Plans → Claude Pro Max (~$100/month). Required for Cowork with scheduled task support. Claude Code works on Pro ($20/month), but Cowork's unattended scheduled audits (Sunday weekly) require Max.

### 1.11 Install Claude Code

```bash
# Mac/Linux (recommended)
curl -fsSL https://claude.ai/install.sh | bash

# Windows (PowerShell)
irm https://claude.ai/install.ps1 | iex

# Mac (Homebrew)
brew install --cask claude-code
```

Close your terminal completely and open a new one, then:

**Verify:** `claude --version`

**Sign in:** Run `claude` in any folder — a browser window opens for login. Complete it. Type `/exit` to leave the session.

### 1.12 Sign up for ChatGPT Plus and install Codex desktop app

**Sign up:** chatgpt.com → Create account → Subscribe to Plus ($20/month).

**Why the desktop app (not CLI):** Claude Code lives inside VS Code; Codex lives in its own window. They both operate on the same project folder on disk, so when Codex writes a file, VS Code picks up the change automatically. One editor, one agent in it. Codex manages code generation from a separate window.

**Install:**

1. Go to chatgpt.com/codex
2. Download for macOS or Windows
3. Open installer — Mac: drag to Applications; Windows: follow installer
4. Launch from Applications (Mac) or Start menu (Windows) and sign in

**Mac requirement:** Codex desktop app requires Apple Silicon (M1/M2/M3+). Intel Macs must use the Codex CLI: `npm install -g @openai/codex`

### 1.13 Final verification

Run all of these. Every one should return a version number or non-error output:

```bash
git --version
node --version
npm --version
python3 --version
code --version
claude --version
git config --global user.name
git config --global user.email
```

Codex desktop: launch it and confirm you're signed in. If it opens and shows your account, it's ready.

---

## Part 2 — Set Up Cowork Access (One-Time)

Cowork is Anthropic's persistent-agent layer built into Claude Projects: project-scoped memory, file/folder attachment, and scheduled tasks. You set up access once at the account level. You create one Cowork project per coding app in Part 3.

### 2.1 Verify Cowork access

Go to claude.ai → sign in → Projects. If you see a "New project" or "Create project" button and can open a project with persistent memory, Cowork is available.

**If Cowork is not available on your plan:** Upgrade to Claude Pro Max. Cowork is not available on the free tier or standard Claude Pro without Max.

### 2.2 Install Claude Desktop (recommended)

Claude Desktop gives you a native app for Cowork with better file attachment and scheduling support than the web interface.

Download from claude.ai/download → install the macOS or Windows version → sign in with your Claude account.

**Verify:** Open Claude Desktop and confirm your account is shown. Projects you create on claude.ai are accessible here.

### 2.3 How per-project Cowork setup works

There is no global project — you create one Cowork project per coding app. Each project gets:

- Its own persistent memory (the build arc for that app)
- The paste-ready instructions from `wiki/technical/vibecoding/project-instructions-template.md`
- The two reference docs attached: `workflow-v3.md` and `setup-guide-v2.md`

The creation steps are in Part 3 (per-project spin-up). Part 2 is complete once your account has Cowork access and Claude Desktop is installed.

---

## Part 3 — Starting a New Coding Project

Repeat Part 3 every time you start a new app. These steps happen before you write any code.

### 3.1 Create the Cowork project for this app

Before running Phases 0–2, create the Cowork project that will be the design venue for this app's entire build arc.

1. Open Claude Desktop (or claude.ai) → Projects → New project
2. Name it after the app: e.g., "Training App Build" or "Bot Detector Build"
3. Inside the project, open Settings or the instructions panel
4. Paste the full instructions block from `wiki/technical/vibecoding/project-instructions-template.md`, replacing `[PROJECT NAME]` and `[FOLDER PATH]`
5. Attach `workflow-v3.md` and `setup-guide-v2.md` to the project knowledge base

**Verify the no-code boundary:** After pasting instructions, ask the project to look at a component file and suggest improvements. It should redirect to spec/design terms or decline. If it analyzes code line-by-line or generates code, tighten the instructions before proceeding.

### 3.2 Run Phases 0–2 in Cowork

Open a new session inside the Cowork project. Work through Discovery, Master Spec, and Architecture one phase at a time. By the end you'll have three documents drafted in the session: PROJECT_BRIEF.md, MASTER_SPEC.md, ARCHITECTURE.md.

Say "Starting design for Slice N" to trigger the pre-slice readiness check before each design session.

### 3.3 Create the GitHub repo

1. github.com → "+" icon → New repository
2. Kebab-case name (e.g., `habit-tracker`, `reddit-control-scraper`)
3. One-line description from your PROJECT_BRIEF
4. Private for lab and client work
5. **Do NOT check "Add a README" or "Add .gitignore"** — you'll add both yourself
6. Click Create repository

### 3.4 Create the local project folder and clone

```bash
cd ~/Desktop/Coding\ Projects
git clone https://github.com/YOUR-USERNAME/REPO-NAME.git
cd REPO-NAME
```

### 3.5 Open in VS Code

```bash
code .
```

### 3.6 Set up your two-window workspace

**In VS Code:** Press Ctrl + ` to open a terminal pane. Do not launch Claude Code yet.

**Codex desktop app:** Launch → click "New project" or "Add project" → browse to the project folder → select it.

**Why this separation matters:** VS Code is Claude Code's home. Codex works in its own window. Both operate on the same folder on disk — when Codex writes a file, VS Code picks up the change automatically and Claude Code can review it without any sync step.

### 3.7 Paste spec documents and automation files

In the VS Code terminal pane, start Claude Code: `claude`

Then paste each instruction one at a time:

```
Save this as .gitignore:
<paste the full .gitignore from the Workflow doc Appendix B>
```

```
Save this as CLAUDE.md at the project root:
<paste the CLAUDE.md template from the Workflow doc Appendix C,
 filling in the project-specific parts — include the write zone
 rule and Cowork role description>
```

```
Save this as AGENTS.md at the project root:
<paste the AGENTS.md template from this Setup Guide Appendix A>
```

```
Create the spec folder and save this as spec/PROJECT_BRIEF.md:
<paste PROJECT_BRIEF.md from the Cowork session>
```

```
Save this as spec/MASTER_SPEC.md:
<paste MASTER_SPEC.md from the Cowork session>
```

```
Save this as spec/ARCHITECTURE.md:
<paste ARCHITECTURE.md from the Cowork session>
```

```
Create these empty folders at the project root:
audit-reports/
phase-5b-drafts/
spec/slices/
```

### 3.8 Create a .env.example (if your project uses API keys)

```
Create .env.example with keys for ANTHROPIC_API_KEY, SUPABASE_URL, and
SUPABASE_ANON_KEY. No values — just the keys.
```

Then create your own local `.env` file (NEVER commit this) with the actual values.

### 3.9 First commit

```
Stage all the new files and make the initial commit with message:
"Initial commit — specs, automation, and scaffold"
Then push to origin/main.
```

Check github.com/YOUR-USERNAME/REPO-NAME — you should see all the files.

---

## Part 4 — Daily Workflow: Building a Slice

Part 4 is the loop you'll run once per feature slice.

**The ten steps of a slice, in order:**

| #   | Step                                       | Where it happens                                                                       |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| 1   | Generate the slice doc                     | **Cowork** — say "Starting design for Slice N"                                         |
| 2   | Save the slice doc                         | Claude Code — save to /spec/slices/ BEFORE building                                    |
| 3   | Run the Codex prompt                       | Codex app — new thread, paste prompt from slice doc                                    |
| 4   | Review + accept Codex's changes            | Codex app — approve each file; check for schema drift                                  |
| 5   | **Claude Code quality review (mandatory)** | VS Code terminal — paste quality review prompt                                         |
| 6   | Run the code and test                      | Fresh terminal — start app, walk through acceptance criteria                           |
| 7   | Debug with Claude Code (if tests fail)     | VS Code terminal — paste error + debugging prompt                                      |
| 8   | Declare the slice verified                 | Claude Code: "Slice N verified — run the post-slice sequence"                          |
| 9   | Move on                                    | Back to **Cowork** for next slice                                                      |
| 10  | **Phase 5b — post-slice reflection**       | Cowork: "Slice N complete, draft Phase 5b reflection" → review draft → wiki agent logs |

**Step-by-step detail:**

**Step 1:** In Cowork: `Starting design for Slice N — [feature description].` Cowork runs a readiness check (open KIs, FUTURE_WORK candidates, DECISIONS.md conflicts, prior slice sequence status) before Phase 0 Q&A begins. Review it, accept or reject each flag, then proceed.

**Step 2:** In Claude Code: `Save this as spec/slices/SLICE_N_NAME.md: <paste the entire slice markdown>`. The slice doc is the blueprint — it goes in BEFORE the build, not after.

**Step 3:** Open the saved slice doc in VS Code. Find "Codex Generation Prompt". Copy it. Switch to Codex desktop → new thread → paste → press Enter.

**Step 4:** Read every diff in the Codex review pane before accepting. Check for: schema drift (column names that don't match your schema), files outside the allowlist, TODO comments. Reject anything suspicious.

**Step 5 (mandatory):** From the slice doc, copy "Claude Code Quality Review Prompt". Paste into Claude Code. Do not skip — this is the step that catches naming drift, missing error handling, duplicate logic, and leftover TODOs before they hit your commit.

**Step 6:** Start your app and walk through every acceptance criterion end-to-end. Note every failure with the exact error message.

**Step 7 (only if step 6 fails):** Fill in the CURRENT PROBLEM section of the debugging prompt template with the exact failure. Paste into Claude Code. Iterate between 6 and 7 until everything passes. Do not ask Codex to fix bugs — that's Claude Code's job.

**Step 8:** When every criterion passes and the full flow works: `Slice N is verified. Run the post-slice sequence.` Claude Code then updates CHANGELOG, DECISIONS, KNOWN_ISSUES, FUTURE_WORK (if applicable), re-locks dependencies, commits, and pushes.

**Step 9:** Back to Cowork for the next slice.

**Step 10:** In Cowork: `Slice N complete, draft Phase 5b reflection.` Cowork reads the CHANGELOG entry, recent KI changes, DECISIONS additions, and FUTURE_WORK additions, then drafts a reflection to `phase-5b-drafts/SLICE_N-reflection.md`. Review the draft. Methodology improvement candidates flow through `second_brain/inbox/` to the wiki agent.

---

## Part 5 — Troubleshooting

| Problem                                                      | Solution                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "command not found: brew" after installing Homebrew          | Scroll up in your terminal output — the installer printed two commands to add it to PATH. Copy-paste them, then close and reopen terminal.                                                                                                                                                                                                                                                                                                  |
| "command not found: claude" after installing                 | Close terminal completely and open a new one. The install adds to your path but existing terminals don't see the update.                                                                                                                                                                                                                                                                                                                    |
| Codex app won't open on Intel Mac                            | Requires Apple Silicon (M1/M2/M3+). Use Codex CLI instead: `npm install -g @openai/codex`                                                                                                                                                                                                                                                                                                                                                   |
| `npm install -g` fails with EACCES permission errors (Mac)   | Do NOT use sudo. Set up a user-level npm prefix: `mkdir ~/.npm-global && npm config set prefix '~/.npm-global'` — then add `~/.npm-global/bin` to your PATH.                                                                                                                                                                                                                                                                                |
| `git push` asks for a password repeatedly                    | You're using your GitHub password. Replace it with a Personal Access Token (section 1.9). Token goes in the password field.                                                                                                                                                                                                                                                                                                                 |
| "fatal: not a git repository" when running git commands      | You're not inside a git repo folder. `cd` into the correct project folder.                                                                                                                                                                                                                                                                                                                                                                  |
| Codex keeps asking for approval on every action              | That's default behavior — you review each change before it's written. You can switch to a less-restrictive approval mode in Codex app settings.                                                                                                                                                                                                                                                                                             |
| Claude Code says CLAUDE.md was not found                     | Run `claude` from the project root (where CLAUDE.md lives), not from a parent folder.                                                                                                                                                                                                                                                                                                                                                       |
| API key errors after setting .env variables                  | Terminal session may have a stale system-level value overriding .env. Run `echo $VAR_NAME` to check, then `export VAR_NAME=value` explicitly in the same session.                                                                                                                                                                                                                                                                           |
| Reddit scraping works locally but fails on Streamlit Cloud   | Reddit blocks cloud-datacenter IPs. Use the Reddit public JSON endpoint (append .json to URLs) or keep the tool local-only.                                                                                                                                                                                                                                                                                                                 |
| Codex invents database column names that don't exist         | Schema drift. In every Codex prompt that touches the database, paste the live schema into CONSTRAINTS and require Codex to echo back the column names it used. Verify before accepting.                                                                                                                                                                                                                                                     |
| **Codex appears stalled after laptop sleep**                 | Wait 2–3 minutes — the API connection may recover on its own. If still stalled, send a continuation prompt listing exactly which tasks completed and which remain. Do NOT click Stop or Review changes prematurely — partial acceptance creates an inconsistent state where some files are written and others are not. **Preventive:** Run `caffeinate -d` in a separate terminal before starting a long Codex generation to prevent sleep. |
| **Cowork scheduled task didn't run (audit, context review)** | Scheduled tasks only fire when Claude Desktop is running and the Mac is awake. If the window was missed, Cowork writes a `[Cowork-missed]` log entry on next start. Check System Settings → Energy Saver — set your Mac to stay awake during Sunday evening windows.                                                                                                                                                                        |
| **Cowork generates code or analyzes source files**           | The no-code boundary is broken. Tighten the project instructions — ensure all three no-code rules are present verbatim. Run the boundary verification test (ask it to look at a component file). Do not proceed with slice design until the boundary holds.                                                                                                                                                                                 |
| **Unsure whether a task belongs to Cowork or Claude Code**   | Default rule: Cowork for design, spec, and audit. Claude Code for everything that touches source files. Trigger phrases disambiguate: "Starting design for Slice N" → Cowork. "Slice N verified — run the post-slice sequence" → Claude Code. When in doubt, ask Cowork to classify the task.                                                                                                                                               |
| **Cowork memory seems stale or contradicts current state**   | Monthly hygiene: ask Cowork to summarize what it remembers about the project. Compare to DECISIONS.md and ARCHITECTURE.md. Locked files are the source of truth — correct stale memory by re-reading, not by trusting the cache.                                                                                                                                                                                                            |
| **Cowork was not the venue for one or more earlier slices**  | During methodology rollout, slices may have been designed in old project chat or elsewhere. Provide the completed spec as authoritative input. Cowork treats externally designed specs as authoritative — it only flags if the spec directly contradicts a locked DECISIONS.md entry.                                                                                                                                                       |

---

## Appendix A — AGENTS.md Template (for Codex)

Paste this at the project root as AGENTS.md. Edit the [PROJECT_NAME] placeholder.

```markdown
# AGENTS.md — Instructions for Codex on this project

## Project

[PROJECT_NAME] — [1-2 sentence description]

## My role in this project

I am Codex — the code generator. My job is to produce the first draft of new
feature slices from clean prompts. I do NOT debug, refine, or iterate — that
is Claude Code's job. When I finish a first draft, my work on that slice is
done.

If asked to fix a bug in existing code, I will stop and ask the user to take
the problem to Claude Code instead.

## Folder structure reference

- /spec/ — MASTER_SPEC.md, ARCHITECTURE.md, PROJECT_BRIEF.md
- /spec/slices/ — SLICE_N_NAME.md files (read the current slice before coding)
- /app/ or /src/ — source code
- /audit-reports/ — Cowork audit outputs (read-only for me)
- /phase-5b-drafts/ — Cowork Phase 5b reflections (read-only for me)

## Rules for every slice I generate

### 1. Stay within the allowlist

The slice document has a "Files to Create or Modify" section. Touch nothing
outside that list. If I think I need to change a file outside the list,
I stop and tell the user.

### 2. Never invent schema

If the slice touches the database, the prompt will include the live schema.
Use only the column names in that schema. Never guess or invent names.
If the prompt does not include a schema for a data-layer slice, I stop and
ask for it.

### 3. No placeholders, no TODOs

Every function I write is complete and working. I do not leave comments like
"// TODO: implement this later" or "# placeholder". If I cannot complete
something, I flag it clearly at the end of my output rather than stubbing it.

### 4. List every assumption at the end

After every slice I finish, I list:

- Every column name I referenced (so the user can diff against the schema)
- Every env var I relied on
- Every external API endpoint I called
- Every decision I made that was not explicit in the prompt

### 5. Stay within scope

The slice document has an "Acceptance Criteria" section. I build only what
those criteria require. I do not add features that are not requested, even
if they seem obvious or helpful.

### 6. Follow the architecture

I read /spec/ARCHITECTURE.md before writing code. Naming conventions, folder
structure, and key dependencies come from there — not from my general
preferences.

## Files I will never touch

- /spec/ (specifications, not code)
- CHANGELOG.md, DECISIONS.md, KNOWN_ISSUES.md, FUTURE_WORK.md (Claude Code maintains these)
- CLAUDE.md, AGENTS.md (project configuration, not my job to edit)
- .env (secrets, never in generated code)
- /audit-reports/ (Cowork writes here)
- /phase-5b-drafts/ (Cowork writes here)
```

---

## Appendix B — Command Cheatsheet

**Navigating the terminal:**

| Action                 | Command          |
| ---------------------- | ---------------- |
| Print current folder   | `pwd`            |
| List files             | `ls -la`         |
| Change folder          | `cd folder-name` |
| Go up one folder       | `cd ..`          |
| Open folder in VS Code | `code .`         |

**Git essentials:**

| Action                  | Command                    |
| ----------------------- | -------------------------- |
| See uncommitted changes | `git status`               |
| Stage all changes       | `git add .`                |
| Commit                  | `git commit -m "message"`  |
| Push to GitHub          | `git push`                 |
| Pull the latest         | `git pull`                 |
| Revert a commit         | `git revert <commit-hash>` |
| View commit history     | `git log --oneline`        |

**Running the AI agents:**

| Action                                            | Command                          |
| ------------------------------------------------- | -------------------------------- |
| Start Claude Code                                 | `claude`                         |
| Exit Claude Code                                  | `/exit`                          |
| Check Claude Code version                         | `claude --version`               |
| Prevent laptop sleep during long Codex generation | `caffeinate -d` (Ctrl+C to stop) |

**Python and Node:**

| Action                   | Command                           |
| ------------------------ | --------------------------------- |
| Run a Streamlit app      | `python3 -m streamlit run app.py` |
| Install a Python package | `pip3 install package-name`       |
| Lock Python dependencies | `pip3 freeze > requirements.txt`  |
| Run a Next.js dev server | `npm run dev`                     |
| Install a Node package   | `npm install package-name`        |

---

## Appendix C — What to Remember

**Hold the roles.** Cowork designs. Codex generates. Claude Code reviews, refines, and debugs. Any time you catch yourself asking Codex to fix something, asking Claude Code to write a new slice from scratch, or asking Cowork to look at source code — stop and take it to the right tool.

**Never skip the quality review.** Step 5 — the mandatory Claude Code review pass — is the part of the workflow people are most tempted to skip when tests happen to pass on the first try. Don't. The review catches the quiet issues that a passing test misses: naming drift, missing error handling, subtle inefficiencies, leftover TODOs.

**The slice doc goes first.** Save SLICE_N.md to /spec/slices/ BEFORE running Codex. The slice doc is the blueprint that the build references, not a record of what was built after the fact.

**Verify before declaring.** Do not tell Claude Code a slice is verified unless you have actually run every acceptance criterion end-to-end.

**Commit after every slice.** Every verified slice is its own commit. You are never more than one commit away from a working state.

**Read the diff.** Before accepting any change Codex proposes, read what it is doing. Thirty seconds per diff. Do not mash "yes" at every approval prompt.

**Capture future work during testing, not after.** If something belongs in FUTURE_WORK.md, write it during step 6 (testing) so it rolls into the post-slice commit. If it surfaces after the commit, use `"Slice N follow-up — [summary]"` as the commit message.

**Use the verbatim trigger phrases.** Three phrases route work to the right agent automatically: `"Starting design for Slice N"` → Cowork (pre-slice readiness check begins). `"Slice N verified — run the post-slice sequence"` → Claude Code (post-slice automation). `"Slice N complete, draft Phase 5b reflection"` → Cowork (reflection draft). Use them verbatim.

**When in doubt, ask Cowork.** The Cowork project has the Workflow doc and this Setup Guide in its knowledge base. If you forget what phase you're in, what a document is supposed to contain, or how a step works — ask. Cowork is the design oracle; Claude Code is the build oracle.

---

## Version History

- **v2.0 (May 2026):** Full Cowork integration. Part 2 rewritten as one-time Cowork access setup (replaces generic Claude Project setup). Part 3 gains Step 3.1 (create Cowork project) and Step 3.7 creates audit-reports/ and phase-5b-drafts/ folders. Part 4 Step 1 and Step 9 updated to Cowork; Step 10 updated with Cowork Phase 5b draft trigger. Part 5 gains five new troubleshooting rows (scheduled task miss, no-code boundary break, task routing ambiguity, memory drift, mid-build migration). AGENTS.md template adds audit-reports/ and phase-5b-drafts/ to never-touch list. Appendix C updated: "ask the project chat" → "ask Cowork"; verbatim trigger phrases added. Export note updated to per-project Cowork pair.
- **v1.0+ living (May 2026):** Step 10 (Phase 5b) added to daily slice loop; Codex sleep recovery added to Troubleshooting and command cheatsheet (`caffeinate -d`); Phase 4B quality review prompt updated with item 8 (named primitive install check) and premise verification constraint; Interaction Rules updated with FUTURE_WORK.md in post-slice sequence and future-work capture timing note; AGENTS.md template updated with FUTURE_WORK.md in "files never to touch" list; "Capture future work during testing" added to Appendix C
- **v1.0 (April 2026):** Initial release
