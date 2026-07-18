# Repository Guidelines

## Repository Role

This repository is the new source of truth for the hackathon project. Do not inspect, copy, migrate, or modify a previous implementation unless the project owner explicitly supplies selected lessons. Repository documentation is persistent project memory; chat context is not a substitute.

## Permanent Operating Rules

1. Treat repository documentation as persistent memory.
2. Before planning any milestone, reread `docs/PRODUCT_VISION.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/DECISIONS.md`, `docs/REQUIREMENTS_TRACEABILITY.md`, and `docs/ACCEPTANCE_TESTS.md`.
3. Never silently omit, reinterpret, postpone, or remove a confirmed requirement.
4. Show every proposed scope change explicitly to the project owner and wait for approval.
5. Distinguish product requirements (required outcomes and behavior) from technical implementation choices.
6. Codex owns technical stack and architecture choices unless the project owner explicitly constrains an outcome.
7. Prefer reliable existing open-source and official tools when they reduce risk, but first review license, maintenance, compatibility, and security.
8. Record every important architecture or product decision in `docs/DECISIONS.md`.
9. Map every confirmed requirement to a milestone and acceptance test in `docs/REQUIREMENTS_TRACEABILITY.md`.
10. Update `docs/PROGRESS.md` after every substantial task.
11. Record important ways Codex and GPT-5.6 accelerated the project in `docs/CODEX_USAGE_LOG.md`.
12. Use small, independently testable milestones.
13. Commit working checkpoints regularly with focused, imperative commit messages.
14. Never expose, print, log, or commit API keys or secrets. Use sanitized examples only.
15. Do not begin major implementation until the initial architecture and milestone plan are explicitly approved by the project owner.

## Documentation Workflow

Convert the master brief into uniquely identified, testable requirements without adding assumed behavior. Record unresolved ambiguity in `docs/OPEN_QUESTIONS.md`. Put evidence-based investigation in `docs/RESEARCH.md`; do not disguise research conclusions as confirmed requirements.

For each substantial task:

1. Read the relevant source-of-truth documents.
2. Identify affected requirement and acceptance-test IDs.
3. Implement only approved scope.
4. Verify the result and attach evidence in the traceability matrix.
5. Update progress, decisions, research, dependency, and Codex usage records as applicable.
6. Commit a working checkpoint.

## Current Approval Gate

The product master brief has not yet been incorporated. Do not select a technology stack, write application code, create UI mockups, install large dependencies, or start implementation. The next allowed activity is capturing and clarifying the master brief, followed by owner approval of the initial architecture and milestone plan.
