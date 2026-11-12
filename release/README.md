# Birchhaven release workflow

The repository owner explicitly approved automatic release publication on 2026-11-12.

Files:
- `.github/workflows/birchhaven-release.yml`: build → Windows smoke test → publish.
- `release/build-release.mjs`: download a pinned public base ZIP, check SHA-256, apply the reviewed delta, verify the complete runtime tree, and build ZIP/bhupdate/JSON.
- `release/smoke.mjs`: start a disposable Windows installation, save a map and character, restart with a map delivery, and verify persistence.
- `release/publish-release.mjs`: create a new draft, verify three uploaded assets, then publish. It never replaces an existing release.
- `release/patches/<version>.json`: compressed changed files, exact before/after hashes and removals.
- `release-request.json`: commit this LAST, after the patch and tooling are ready. Only a change to this file on main or a manual run triggers publication.

Build and test jobs have read-only repository access. Only the publish job has contents-write permission, using GitHub's short-lived job token. Never put tokens, local saves, backups or private map-inbox credentials in this repository.

For future changes, start from the latest saved Birchhaven source archive, inspect docs/technical-overview.md and current code, run the scoped checks and required release gate, and produce a local runtime package. Use scripts/prepare-release-patch.mjs to prepare a delta against a previously published ZIP. Check the base archive SHA-256 and final runtime fingerprint before committing the request.

The private map inbox is separate from game releases. Retrieve complete synchronized map submissions through its owner-authorized service access, validate them, and use scripts/prepare-map-release.mjs to prepare a versioned map delivery. Preserve newer local drafts and player saves.

A successful Windows smoke run verifies launch and server-side persistence. It does not verify interactive gameplay, graphics, or signed-in browser map transfer. Read the actual Actions result and release assets before reporting a release as published.
