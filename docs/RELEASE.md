# Release checklist (@jml6m/skeletor)

## One-time: npm Trusted Publishing

CI publish uses **OIDC Trusted Publishing** (no long-lived `NPM_TOKEN`). Configure this **before** the first tag-driven release.

1. Open [package settings on npm](https://www.npmjs.com/package/@jml6m/skeletor/settings) → **Trusted publishing** → **GitHub Actions**.
2. Enter **exactly** (case-sensitive):

   | Field | Value |
   |-------|-------|
   | Organization or user | `jml6m` |
   | Repository | `skeletor` |
   | Workflow filename | `publish.yml` |
   | Environment name | `npm` |
   | Allowed actions | `npm publish` |

3. Save. npm does **not** validate these fields until the first publish attempt.

The workflow uses GitHub environment `npm` and requires `id-token: write` for OIDC.

## Publish v0.x.y (CI — recommended)

```bash
# 1. Ensure main is green and version is bumped in package.json
npm test && npm run lint:encoding && npm run audit:ci

# 2. Commit version bump if needed, then tag (must match package.json)
git tag v0.2.0   # example — version in package.json must be 0.2.0
git push origin v0.2.0
```

The [Publish to npm](https://github.com/jml6m/skeletor/actions/workflows/publish.yml) workflow will:

1. Verify tag ↔ `package.json` version
2. Verify the version is not already on npm
3. Run lint, audit, and tests
4. Run `npm publish --dry-run` (auth preflight)
5. Publish with provenance

### Re-run after a failed publish

If the tag already exists (e.g. `v0.2.0`):

- **Preferred:** Actions → **Publish to npm** → **Run workflow** (workflow_dispatch), or **Re-run failed jobs**.
- **Re-tag:** only if you deleted the remote tag first:
  ```bash
  git push origin :refs/tags/v0.2.0
  git tag -d v0.2.0
  git tag v0.2.0
  git push origin v0.2.0
  ```

## Publish manually (fallback)

Use when Trusted Publishing is not configured yet:

```bash
npm publish --tag latest --access public --otp=<code>
```

`prepublishOnly` runs lint, audit, and tests automatically.

For prereleases:

```bash
npm run release:alpha   # bumps 0.2.0 → 0.2.1-alpha.0, pushes tag
# or bump package.json manually, then tag v0.2.1-alpha.0
```

Dist-tags: stable releases get `latest`; prereleases get the preid segment (`alpha`, `beta`, …) per the publish workflow.

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `E404` on `npm publish` in CI | Trusted Publishing not configured or fields mismatch | Match table above on npmjs.com |
| `E404` with wrong workflow name | Workflow file renamed | Update npm trusted publisher `Workflow filename` |
| Tag pushed but version mismatch | `v0.2.1` tag with `0.2.0` in package.json | Align tag and `package.json`, re-tag |
| Version already published | Re-pushed same tag | Bump version, new tag |
| Provenance OK but publish fails | Environment name mismatch | Set environment to `npm` on npm **and** in workflow |

## Version bump helpers

```bash
npm run release:patch   # 0.2.0 → 0.2.1 + tag
npm run release:minor   # 0.2.0 → 0.3.0 + tag
npm run release:major   # 0.2.0 → 1.0.0 + tag
npm run release:alpha   # prerelease bump + tag
```

Each script runs `npm version`, commits, tags `v*`, and `git push --follow-tags`.