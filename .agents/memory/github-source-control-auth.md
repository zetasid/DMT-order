---
name: GitHub source-control auth
description: Replit GitHub OAuth status can disagree with Git CLI access to a remote.
---

Do not infer remote availability from a healthy GitHub OAuth status or listed `repo` / `workflow` scopes alone. Git CLI may still reject authentication. A public unauthenticated GitHub API lookup returning 404 is also ambiguous for a private repository; it does not prove the repository is absent or empty.

**Why:** syncing or pushing without authenticated remote inspection could target an unverified repository state.

**How to apply:** before comparing histories or pushing, verify authenticated remote refs. If authentication fails, stop and have the user reconnect GitHub through Replit; do not guess repository contents or ask them to paste a token.
