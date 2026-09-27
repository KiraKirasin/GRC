# Microsoft 365 Copilot — NovaPay GRC Declarative Agent

Sidecar package so **Microsoft 365 Copilot** can call the NovaPay GRC API
(projects, controls, chat) via an API plugin.

## What you get

| Piece | Purpose |
|-------|---------|
| `appPackage/manifest.json` | Teams / M365 app manifest (declarative agent) |
| `appPackage/declarativeAgent.json` | Agent instructions + plugin reference |
| `appPackage/ai-plugin.json` | API plugin descriptor for Copilot |
| `appPackage/openapi.yaml` | OpenAPI 3 for GRC endpoints Copilot can call |
| In-app `/copilot` | Same agent via Azure OpenAI inside the GRC UI |

## Prerequisites

1. Public HTTPS GRC URL (pilot VM or custom domain), e.g. `https://grc.example.com`.
2. Azure OpenAI deployment for the **in-app** agent (`AZURE_OPENAI_*` in `.env`).
3. Microsoft 365 tenant with Copilot, and permission to sideload/upload apps.
4. OAuth or API key strategy for Copilot → GRC (JWT login or a dedicated service account).

## Configure the package

1. Replace `https://grc.example.com` in `openapi.yaml` and `ai-plugin.json` with your real `APP_URL`.
2. Set `id` / publisher fields in `manifest.json` to your Entra app / Teams app ids if required by your tenant.
3. Zip the contents of `appPackage/` (files at zip root, not a nested folder):

```bash
cd copilot-agent/appPackage
zip -r ../NovaPay-GRC-Copilot.zip \
  manifest.json declarativeAgent.json ai-plugin.json openapi.yaml
```

4. In Microsoft 365 Admin / Teams Developer Portal / Copilot Studio:
   - Upload the zip as a custom app / declarative agent, **or**
   - Import the OpenAPI plugin into Copilot Studio and attach it to an agent.

## Auth note

Copilot plugins typically use OAuth 2.0 or API key. For the pilot:

- Prefer a **service account** JWT obtained via `/api/auth/login`, stored as a plugin secret, **or**
- Expose a narrow read-only API key middleware later.

Do not put end-user passwords in the plugin package.

## In-app agent (no M365 sideload required)

```bash
# .env
AZURE_OPENAI_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
```

Restart the API, open **CISO Copilot** in the app, and ask about gaps/projects.
Without Azure vars the agent still answers from live GRC DB (local fallback).
