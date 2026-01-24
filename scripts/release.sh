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
else
    echo "📥 Pulling latest changes from develop..."
    git pull origin develop
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
    echo "📜 Extracting changelog entries from merged PRs..."
    
    # Get the last release tag to find PRs merged since then
    LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    
    if [ -z "$LAST_TAG" ]; then
        echo "⚠️  No previous tags found. Fetching all merged PRs from the last 30 days..."
        SINCE_DATE=$(date -v-30d +%Y-%m-%d 2>/dev/null || date -d '30 days ago' +%Y-%m-%d)
        SEARCH_QUERY="is:pr is:merged merged:>=$SINCE_DATE base:develop"
    else
        echo "📌 Last release: $LAST_TAG"
        # Get the ISO 8601 timestamp of the last tag
        TAG_DATE=$(git log -1 --format=%aI "$LAST_TAG")
        SEARCH_QUERY="is:pr is:merged merged:>$TAG_DATE base:develop"
    fi
    
    # Fetch merged PRs with their bodies
    PRS_JSON=$(gh pr list --search "$SEARCH_QUERY" --state merged --limit 100 --json number,title,body,labels)
    
    # Initialize category arrays
    FEATURES=""
    FIXES=""
    DOCS=""
    INTERNAL=""
    
    # Process each PR
    echo "$PRS_JSON" | jq -r '.[] | @json' | while IFS= read -r pr; do
        PR_NUMBER=$(echo "$pr" | jq -r '.number')
        PR_TITLE=$(echo "$pr" | jq -r '.title')
        PR_BODY=$(echo "$pr" | jq -r '.body // ""')
        
        # Extract changelog entry from PR body
        CHANGELOG_ENTRY=$(echo "$PR_BODY" | awk '
            /^## Changelog Entry/ { found=1; next }
            found && /^## / { exit }
            found && NF { print; found_content=1 }
            END { if (!found_content) exit 1 }
        ' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || echo "")
        
        # If no changelog entry found, use PR title
        if [ -z "$CHANGELOG_ENTRY" ]; then
            CHANGELOG_ENTRY="$PR_TITLE"
        fi
        
        # Determine category from PR body checkboxes
        CATEGORY=""
        if echo "$PR_BODY" | grep -q '\[x\].*Feature/Enhancement'; then
            CATEGORY="feature"
        elif echo "$PR_BODY" | grep -q '\[x\].*Bug Fix'; then
            CATEGORY="fix"
        elif echo "$PR_BODY" | grep -q '\[x\].*Documentation'; then
            CATEGORY="docs"
        elif echo "$PR_BODY" | grep -q '\[x\].*Internal/Chore'; then
            CATEGORY="internal"
        else
            # Fallback: check labels
            LABELS=$(echo "$pr" | jq -r '.labels[].name')
            if echo "$LABELS" | grep -qi 'enhancement\|feature'; then
                CATEGORY="feature"
            elif echo "$LABELS" | grep -qi 'bug\|fix'; then
                CATEGORY="fix"
            elif echo "$LABELS" | grep -qi 'documentation'; then
                CATEGORY="docs"
            else
                CATEGORY="internal"
            fi
        fi
        
        # Format entry
        ENTRY="* $CHANGELOG_ENTRY (#$PR_NUMBER)"
        
        # Append to appropriate category (write to temp files to preserve across subshell)
        case $CATEGORY in
            feature)
                echo "$ENTRY" >> /tmp/release_features.txt
                ;;
            fix)
                echo "$ENTRY" >> /tmp/release_fixes.txt
                ;;
            docs)
                echo "$ENTRY" >> /tmp/release_docs.txt
                ;;
            internal)
                echo "$ENTRY" >> /tmp/release_internal.txt
                ;;
        esac
    done
    
    # Build the changelog notes
    NOTES=""
    
    if [ -f /tmp/release_features.txt ]; then
        NOTES+="### Features\n"
        NOTES+="$(cat /tmp/release_features.txt)\n\n"
        rm /tmp/release_features.txt
    fi
    
    if [ -f /tmp/release_fixes.txt ]; then
        NOTES+="### Bug Fixes\n"
        NOTES+="$(cat /tmp/release_fixes.txt)\n\n"
        rm /tmp/release_fixes.txt
    fi
    
    if [ -f /tmp/release_docs.txt ]; then
        NOTES+="### Documentation\n"
        NOTES+="$(cat /tmp/release_docs.txt)\n\n"
        rm /tmp/release_docs.txt
    fi
    
    if [ -f /tmp/release_internal.txt ]; then
        NOTES+="### Internal\n"
        NOTES+="$(cat /tmp/release_internal.txt)\n\n"
        rm /tmp/release_internal.txt
    fi
    
    # Add Full Changelog link
    if [ -n "$LAST_TAG" ]; then
        NOTES+="**Full Changelog**: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\).git/\1/')/compare/$LAST_TAG...$NEW_VERSION"
    else
        NOTES+="**Full Changelog**: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\).git/\1/')/commits/$NEW_VERSION"
    fi
    
    DATE=$(date +%Y-%m-%d)
    TEMP_CHANGELOG=$(mktemp)
    
    printf "## [%s] - %s\n\n%b\n\n" "${NEW_VERSION#v}" "$DATE" "$NOTES" > "$TEMP_CHANGELOG"
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
