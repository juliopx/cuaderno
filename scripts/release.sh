#!/bin/bash

# Exit on error
set -e

# 1. Ensure we are on develop branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ]; then
    echo "⚠️  You are currently on branch '$CURRENT_BRANCH'."
    read -p "Do you want to switch to 'develop' and continue? (y/n): " switch_confirm
    if [[ $switch_confirm == [yY] || $switch_confirm == [yY][eE][sS] ]]; then
        git checkout develop
        git pull origin develop
    else
        echo "❌ Release must be performed from the 'develop' branch."
        exit 1
    fi
fi

# 2. Run checks
echo "🚀 Running checks..."
npm run check

# 3. Determine version (default to patch)
BUMP=${1:-patch}
CURRENT_VERSION=$(node -p "require('./package.json').version")

echo ""
echo "📢 PREPARING RELEASE"
echo "------------------"
echo "Current version: $CURRENT_VERSION"
echo "Bump type:       $BUMP"
echo "------------------"
echo ""

read -p "Do you want to proceed with the release? (y/n): " confirm
if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
    echo "❌ Release cancelled by user."
    exit 1
fi

echo "📦 Bumping version ($BUMP)..."
NEW_VERSION=$(npm version $BUMP --no-git-tag-version)
# Ensure package-lock.json is updated
npm install --package-lock-only

# Remind about PR labels for better changelog
if command -v gh &> /dev/null; then
    echo ""
    echo "💡 Reminder: Ensure your PRs have appropriate labels for changelog categorization:"
    echo "   - enhancement (Features)"
    echo "   - fix (Bug Fixes)"
    echo "   - documentation (Documentation)"
    echo "   - chore (Internal)"
    echo ""
fi

# 4. Fetch Release Notes and update CHANGELOG.md
if command -v gh &> /dev/null; then
    echo "📜 Generating release notes from GitHub..."
    NOTES=$(gh api "repos/:owner/:repo/releases/generate-notes" \
        -f tag_name="$NEW_VERSION" \
        -f target_commitish="develop" \
        --jq .body)
    
    DATE=$(date +%Y-%m-%d)
    TEMP_CHANGELOG=$(mktemp)
    
    printf "## [%s] - %s\n\n%s\n\n" "${NEW_VERSION#v}" "$DATE" "$NOTES" > "$TEMP_CHANGELOG"
    if [ -f CHANGELOG.md ]; then
        cat CHANGELOG.md >> "$TEMP_CHANGELOG"
    fi
    mv "$TEMP_CHANGELOG" CHANGELOG.md
    echo "✅ CHANGELOG.md updated."
fi

# 5. Commit changes
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release $NEW_VERSION"

# 6. Push to develop
echo "📤 Pushing to develop..."
git push origin develop

# 7. Handle PR creation
if command -v gh &> /dev/null; then
    echo "✨ GitHub CLI detected. Creating/Updating PR..."
    # Try to create PR, if it exists, it will just fail silently or we can ignore
    gh pr create --base main --head develop --title "Release $NEW_VERSION" --body "Automated release PR for $NEW_VERSION" || echo "PR already exists, updated with new commits."
else
    echo "⚠️  GitHub CLI (gh) not found."
    echo "🔗 Please open a PR manually: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\).git/\1/')/compare/main...develop?expand=1"
fi

echo "✅ Done! $NEW_VERSION is ready for review in develop."
