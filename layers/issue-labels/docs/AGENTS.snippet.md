Labels are GitHub's defaults plus the ones seeded below. `chore` marks maintenance and process work that is
neither a feature nor a bug.

- **Component labels use an `area:` prefix** (`area:api`, `area:cli`), starting with the first one, so the
  taxonomy never needs renaming later.
- **Gate labels** block a merge until a human acts (for example `needs-admin-verification`). Only add one when
  a required status check actually reads the label, and when the gated action needs someone other than the PR
  author. Otherwise it is just a sticky note; use a comment instead.
