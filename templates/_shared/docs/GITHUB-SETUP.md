# GitHub repo setup checklist

`skeletor` scaffolds project files only — it does not touch GitHub.com repo
settings. The items below are common conventions worth configuring once,
right after your first push, so this repo doesn't quietly drift from
whatever else you maintain.

## 1. Branch ruleset (default branch)

Require pull requests, keep history linear, and block force-pushes/deletion:

```bash
gh api repos/{{REPO_OWNER}}/{{REPO_NAME}}/rulesets \
  --method POST \
  --input - <<'JSON'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false
      }
    }
  ]
}
JSON
```

Once CI is running on real PRs, list your workflow job names and add them as
`required_status_checks` (fill in the `context` values from
`.github/workflows/*.yml` — e.g. the `jobs.<id>` keys, or matrix job names
like `test (22)`):

```bash
gh api repos/{{REPO_OWNER}}/{{REPO_NAME}}/actions/workflows --jq '.workflows[].name'
```

## 2. Merge-button config

Squash-only, delete branches on merge:

```bash
gh api repos/{{REPO_OWNER}}/{{REPO_NAME}} --method PATCH \
  -f allow_merge_commit=false \
  -f allow_rebase_merge=false \
  -f allow_squash_merge=true \
  -f delete_branch_on_merge=true
```

## 3. Tag ruleset (`v*`) — only if this repo cuts versioned releases

Immutable release tags — a published version should never move or disappear:

```bash
gh api repos/{{REPO_OWNER}}/{{REPO_NAME}}/rulesets \
  --method POST \
  --input - <<'JSON'
{
  "name": "v*",
  "target": "tag",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["v*"], "exclude": [] } },
  "rules": [{ "type": "deletion" }, { "type": "update" }]
}
JSON
```

Skip this one for repos that don't publish tagged releases.
