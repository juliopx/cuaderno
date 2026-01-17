#!/bin/bash

# Exit on error
set -e

# 1. Run checks
echo "🚀 Running checks..."
npm run check

# 2. Determine version (default to patch)
BUMP=${1:-patch}
echo "📦 Bumping version ($BUMP)..."
NEW_VERSION=$(npm version $BUMP --no-git-tag-version)

# 3. Commit version change in develop
git add package.json package-lock.json
git commit -m "chore: release $NEW_VERSION"

# 4. Push to develop
echo "📤 Pushing to develop..."
git push origin develop

# 5. Handle PR creation
if command -v gh &> /dev/null; then
    echo "✨ GitHub CLI detected. Creating PR..."
    gh pr create --base main --head develop --title "Release $NEW_VERSION" --body "Automated release PR for $NEW_VERSION"
else
    echo "⚠️  GitHub CLI (gh) not found."
    echo "🔗 Please open a PR manually: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\).git/\1/')/compare/main...develop?expand=1"
fi

echo "✅ Done! Version bumped to $NEW_VERSION and pushed to develop."
