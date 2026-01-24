---
description: How to create a Pull Request with the mandatory template
---
// turbo-all

# PR Creation Workflow

Follow these steps when you are ready to submit your changes for review.

### 1. Prepare the PR Body
Use the content from `.github/pull_request_template.md` as the base for your PR description. 

### 2. Fill the Template
Ensure you complete all sections:
- **Description**: Detailed summary of changes.
- **Type of Change**: Mark with `[x]`.
- **Related Issue**: Use `Fixes #XX` or `Closes #XX`.
- **Changelog Entry**: Concise description for users.
- **Testing**: Summary of how you verified the fix.

### 3. Create the PR using CLI
Run the following command, replacing `<BODY_CONTENT>` with your filled template:

```bash
gh pr create --base develop --title "chore: <brief title>" --body "<BODY_CONTENT>"
```

Alternatively, save your body to a temporary file:
```bash
gh pr create --base develop --title "chore: <brief title>" --body-file .pr_body.md
rm .pr_body.md
```

### 4. Notify the User
Inform the user that the PR is ready for review and provide the link.
