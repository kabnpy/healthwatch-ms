#!/usr/bin/env bash
# Portable GitHub repository policy bootstrapper.
# Usage:
#   ./scripts/setup-repo-policy.sh                # applies to current repo
#   ./scripts/setup-repo-policy.sh owner/repo     # applies to a specific repo
#
# Requires: gh CLI authenticated with repo admin permissions.

set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
DEFAULT_BRANCH="$(gh repo view "$REPO" --json defaultBranchRef -q .defaultBranchRef.name)"

echo "Configuring git hygiene for $REPO (default branch: $DEFAULT_BRANCH)..."

# 1. Auto-delete head branches + squash-merge using PR title
gh api --method PATCH "repos/$REPO" \
  -F delete_branch_on_merge=true \
  -F allow_squash_merge=true \
  -f squash_merge_commit_title="PR_TITLE" \
  -f squash_merge_commit_message="PR_BODY" \
  --silent
echo "✓ Enabled auto-delete head branches & squash-merge with PR title"

# 2. Secret scanning & push protection (best-effort; requires public repo or GHAS)
if gh api --method PATCH "repos/$REPO" \
  -f security_and_analysis='{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}' \
  --silent 2>/dev/null; then
  echo "✓ Enabled secret scanning & push protection"
else
  echo "⚠ Skipped secret scanning/push protection (requires public repo or GitHub Advanced Security)"
fi

# 3. Protect default branch via GitHub Ruleset (idempotent by name)
RULESET_NAME="Protect $DEFAULT_BRANCH"
EXISTING_ID="$(gh api "repos/$REPO/rulesets" --jq ".[] | select(.name == \"$RULESET_NAME\") | .id" 2>/dev/null || true)"

PAYLOAD="$(cat <<EOF
{
  "name": "$RULESET_NAME",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["~DEFAULT_BRANCH"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    }
  ]
}
EOF
)"

if [[ -n "$EXISTING_ID" ]]; then
  gh api --method PUT "repos/$REPO/rulesets/$EXISTING_ID" --input - <<< "$PAYLOAD" --silent
  echo "✓ Updated ruleset '$RULESET_NAME' (id: $EXISTING_ID)"
else
  gh api --method POST "repos/$REPO/rulesets" --input - <<< "$PAYLOAD" --silent
  echo "✓ Created ruleset '$RULESET_NAME'"
fi

echo "Done."
