# AGENTS.md

## Project overview
This repository contains source code for a Google Apps Script project synced with `clasp`.

The project may include:
- `.gs` files
- `.js` files
- `.html` files
- `appsscript.json`
- `.clasp.json`

## Goal
Make safe, minimal, reviewable changes to the Apps Script codebase.

## Rules
- Edit only files relevant to the requested task.
- Do not modify unrelated files.
- Keep changes small and focused.
- Preserve existing behavior unless the task explicitly asks to change it.
- Keep compatibility with Google Apps Script V8 runtime.
- Do not add secrets, tokens, API keys, credentials, or private data.
- Do not remove or rename `.clasp.json` unless explicitly requested.
- Do not change `appsscript.json` unless the task requires it.
- Prefer simple Apps Script-native solutions over unnecessary abstractions.
- Keep function names clear and consistent with existing project style.
- Avoid introducing new dependencies unless explicitly requested.
- When editing UI code (`.html`), keep it compatible with Apps Script HTML Service.

## Google Apps Script specifics
- Be careful with triggers, custom menus, SpreadsheetApp, DriveApp, GmailApp, UrlFetchApp, and PropertiesService usage.
- Do not break entry-point functions used by triggers, menus, web apps, or macros.
- If a function name may be referenced externally, preserve it unless explicitly asked to rename it.
- If changing manifest-related behavior, explain what changed in `appsscript.json`.

## Workflow
- Prefer working in a separate branch.
- Prepare changes as a pull request into `main`.
- Summarize changed files and the reason for each change.
- Mention any assumptions if project context is incomplete.

## Validation
- If the repository contains tests or lint scripts, run them.
- If no tests exist, perform a static sanity check.
- Check for obvious syntax issues and broken references.
- Call out anything that could not be verified locally.

## Output format
When completing a task:
1. Summarize what was changed.
2. List the files modified.
3. Mention risks or assumptions.
4. Suggest any manual follow-up steps.
5. If deployment to Apps Script is needed, remind the user to run:
   - `git pull`
   - `clasp push`

## Avoid
- Large refactors unless explicitly requested
- Silent behavior changes
- Unnecessary file renames
- Placeholder code left unfinished
- Adding mock credentials or fake secrets
