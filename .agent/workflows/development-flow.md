---
description: Development and Validation Rules
---

// turbo-all

# Development Flow

This document establishes the mandatory rules for development in this repository.

## 1. Branch Creation
- All new feature or bug fix branches must start from `develop`.
- Use `gh issue develop <ID>` to automate creation and linking.

## 2. Pull Request Process
- Upon completing development, open a PR targeting `develop`.
- **IMPORTANT**: Do not close the Issue or merge the PR without prior validation.

## 3. Mandatory Validation (Golden Rule)
- The developer (Antigravity) **MUST NEVER** merge a PR into `develop` or close an Issue without explicit approval from the user after local testing (`npm run dev`).

## 4. Merging and Releases
- After validation, merge into `develop`.
- Releases to `main` are handled exclusively via `npm run release`.

## 5. Branch Protection (Governance)

To limit who can merge and ensure validation, a **Ruleset** (named `Standard branch protection`) must be configured on GitHub (Settings > Rulesets):

### Targeted Branches
- **Include default branch** (covers `main`).
- **Include by pattern**: `develop`.

### Rules Enforcement
- **Enforcement status**: `Active`.
- **Bypass list**: It is recommended to **remove "Repository admin"** from the bypass list to ensure the Golden Rule applies even to administrators.

### Mandatory Protections
- **Require a pull request before merging**:
    - **Required approvals**: 1 (User validation).
    - **Dismiss stale pull request approvals when new commits are pushed**: Checked.
- **Require status checks to pass**:
    - Select the **`build`** job (covers linting and compilation).
- **Require conversation resolution before merging**: Checked.
- **Block force pushes**: Checked.
- **Require linear history**: Checked (prevents merge commits).

> [!TIP]
> Use **CODEOWNERS** to automatically assign reviewers to specific project folders.