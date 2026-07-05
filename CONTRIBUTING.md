# Contributing Guide - Amica Project

Amica is a women's safety and security application developed as a team project. This guide explains how beginner developers should work with branches, issues, commits, pull requests, and CI/CD.

The most important rule is simple:

```text
Do your work in a separate branch, then open a pull request to dev.
```

## Branch Strategy

We use branches to keep production-ready code separate from active development work.

- `main`  
  Production/demo-ready branch. This branch should contain stable code only. Do not push directly to `main`.

- `dev`  
  Main development branch. Completed features are merged into `dev` through pull requests.

- `feature/*`  
  Use for new features.

- `bugfix/*`  
  Use for fixing bugs.

- `docs/*`  
  Use for documentation updates.

- `ci/*`  
  Use for GitHub Actions, CI/CD, or workflow changes.

- `refactor/*`  
  Use for code cleanup that does not change app behavior.

Do not push directly to `main`.  
Do not push directly to `dev` unless it is a very small documentation change approved by the team.

## Branch Naming Convention

Use this format:

```text
<type>/<issue-number>-short-description
```

Examples:

```text
feature/11-firestore-schema
feature/15-emergency-contact-service
feature/20-sos-alert-trigger
bugfix/24-fix-firestore-rules
docs/28-update-firebase-setup
ci/31-update-backend-ci
refactor/35-clean-service-models
```

If there is no issue number yet, create or ask for an issue first. Issues help the team know why a branch exists.

## Beginner Workflow

Follow these steps when starting any task.

1. Make sure you are on `dev`.

```bash
git checkout dev
git pull origin dev
```

2. Create a new branch from `dev`.

```bash
git checkout -b feature/11-firestore-schema
```

3. Make your changes.

For example, if you are working on Firestore schema docs or backend services, edit files inside:

```text
docs/
firestore.rules
functions/src/
seed-data/
```

4. Check what changed.

```bash
git status
git diff
```

5. Run relevant checks.

```bash
cd functions
npm install
npm test
```

You can also validate JSON files from the repo root:

```bash
python -m json.tool seed-data/vehicles.json
python -m json.tool firestore.indexes.json
```

6. Stage and commit your changes.

```bash
git add docs firestore.rules functions/src
git commit -m "Design Firestore database structure"
```

7. Push your branch.

```bash
git push origin feature/11-firestore-schema
```

8. Open a pull request on GitHub.

The pull request should target:

```text
base branch: dev
compare branch: your feature branch
```

## Commit Message Examples

Good commit messages are short and clear.

Good examples:

```text
Design Firestore database structure
Add emergency contact service placeholder
Update Firebase setup documentation
Fix SOS alert model typing
```

Avoid vague messages:

```text
changes
update
final
fix
my work
```

## Pull Request Guidelines

Before opening a pull request, make sure:

- Your branch is created from the latest `dev`.
- Your pull request targets `dev`, not `main`.
- Your code or documentation matches the issue you are solving.
- You did not commit Firebase service account keys, API keys, private config files, or access tokens.
- You ran relevant checks, or you explained why you could not run them.
- Your pull request description explains what changed.

Example pull request summary:

```text
This PR documents the Firestore database structure for the backend.

Changes:
- Defines users collection fields
- Defines emergency contacts collection fields
- Defines journeys and SOS alerts collection fields
- Updates database schema documentation

Checks:
- npm test
- python -m json.tool firestore.indexes.json
```

## Issue Workflow

Each task should have a GitHub issue.

An issue usually includes:

- A clear title
- A short description
- A checklist
- Labels such as `backend`, `firebase`, `ai`, or `priority-high`
- One assignee
- A milestone

Example issue title:

```text
Implement SOS alert backend
```

Example checklist:

```text
- [ ] Create SOS alert document
- [ ] Save trigger type
- [ ] Save live location
- [ ] Save timestamp
- [ ] Prepare notification service placeholder
```

When you open a pull request, link the issue in the PR description:

```text
Closes #12
```

## CI/CD Basics

CI/CD means GitHub automatically checks the project when code is pushed or a pull request is opened.

For this repository, CI may run commands like:

```bash
cd functions
npm install
npm test
python -m json.tool seed-data/vehicles.json
```

If CI fails:

1. Open the failed GitHub Actions run.
2. Read the error message.
3. Fix the problem in your branch.
4. Commit and push again.

Do not ignore failed CI. Ask the team for help if the error is confusing.

## Backend Development Notes

This repository contains Firebase backend scaffolding.

Main areas:

- `firestore.rules` for Firestore security rules
- `firestore.indexes.json` for Firestore index definitions
- `firebase.json` for Firebase project configuration
- `functions/src/models/` for TypeScript data models
- `functions/src/services/` for backend service logic
- `functions/src/triggers/` for Firebase trigger placeholders
- `functions/src/utils/` for shared helper functions
- `seed-data/` for sample demo data
- `docs/` for Firebase and database documentation

When adding backend code:

- Keep TypeScript types strict and readable.
- Validate user ownership before reading or writing user data.
- Keep security rules conservative.
- Use placeholder comments when real notification or Firebase integration will be added later.
- Add or update tests when behavior changes.

## Secrets and Private Data

Never commit:

- API keys
- Firebase service account files
- `.firebaserc` with production project IDs if the team has not approved it
- Private keys
- Access tokens
- Real user records
- Real user location data
- Production database exports

If you accidentally commit a secret, tell the team immediately. Do not try to hide it with another commit.

## Asking for Help

Ask for help when:

- You are not sure which branch to use.
- You do not understand an issue.
- Firebase or TypeScript commands fail and you cannot understand why.
- You need Firebase project access.
- You are unsure whether a file contains private data.

A good help message includes:

```text
I am working on issue #12.
My branch is feature/12-sos-alert-backend.
I ran npm test and got this error: <paste error here>.
I already checked the model import and tsconfig.
```

## Quick Reference

Common commands:

```bash
git checkout dev
git pull origin dev
git checkout -b feature/12-short-description
git status
git add .
git commit -m "Short clear message"
git push origin feature/12-short-description
```

Before requesting review:

```bash
cd functions
npm test
```
