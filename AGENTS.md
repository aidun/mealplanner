# Agent Instructions

- Prefer German for user-facing conversation in this repository.
- Start with `README.md` before substantial work.
- This repository already has cluster deployment overlays under `deploy/`; treat them as application manifests, while `/Users/markus/repo/clustermanager` remains the GitOps source of truth for the shared home cluster baseline.
- If work touches Kubernetes manifests, cluster deployment, or secret handling, read `/Users/markus/repo/clustermanager/docs/security/README.md` first and follow the linked docs for segmentation, SealedSecrets, secret monitoring, TLS ideas, SSO ideas, and app update ideas.
- Do not redefine cluster-wide security conventions locally. Namespace posture, baseline NetworkPolicies, Kyverno rules, and secret visibility belong to `clustermanager`.
- Git-managed secrets belong in `SealedSecret` manifests. Do not commit live `Secret` objects except `*.secret.example.yaml`. Secrets that must stay outside Git need documented classification with `security.aidun.dev/management=live-only|generated`.
- For shared cluster namespaces, expect `security.aidun.dev/segmentation=planned|enforced` on namespaces and `security.aidun.dev/owner=<owner>` on workloads once enforcement is enabled.
- The cluster secret inventory dashboard is informational only. It tracks normal Secrets and SealedSecrets, but does not replace documentation or secret rotation discipline.
- Do not store real secrets, tokens, kubeconfigs, or passwords in tracked files.
