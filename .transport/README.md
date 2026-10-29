# Authorized original Git history transport

This auxiliary branch carries only a verified bundle split into bounded parts of at most 320KiB, a manifest, a restoration helper and one GitHub Actions workflow.

The user explicitly approved the AGENTS.md exception for these bundle parts. No third-party transfer service is used.

The workflow checks the bundle SHA256,4 exact commit objects and author/committer/date/parent headers,367 file blobs and SHA256s, base ancestry and git fsck. It only then creates feat/art-player-feedback-20261029 using normal git push at exact HEAD4c835fdd62d16afa1f1236c75792e7d7764ab4f8. A different existing target HEAD causes an abort.

PR44/main are never updated or merged. No deployment. Chinese/Japanese candidate mappings remain unchanged. This branch is not the art implementation PR.

The auxiliary CI configuration excludes only this transport branch from the ordinary full regression push job. The original target4c835fd CI is unchanged; its new Draft PR will run normal validation. Transport files are explicitly marked binary to preserve bytes.
