# Cross-instance promotion demo (two Docker instances)

Runs a **producing** (`dev`) and a **consuming** (`prd`) n8n instance side by
side so you can walk the full `pair → mark → pull → review → apply` flow from
[`SPIKE-PLAN.md`](../SPIKE-PLAN.md).

| Instance | Role | URL | Docker hostname |
|----------|------|-----|-----------------|
| `n8n-dev` | producing | http://localhost:5678 | `n8n-dev` |
| `n8n-prd` | consuming | http://localhost:5679 | `n8n-prd` |

## 1. Build the image (contains the prototype code)

From the repo root:

```bash
pnpm build:docker
```

This produces `n8nio/n8n:local`. Rebuild it whenever you change backend/frontend
code, then recreate the containers (`docker compose up -d --force-recreate`).

## 2. Start both instances

```bash
cd packages/cli/src/modules/promotion-review-prototype/demo
docker compose up -d
docker compose logs -f        # optional: watch startup
```

Open each URL and complete owner setup (they are independent instances with
their own database + encryption key).

## 3. Walk the demo

1. **dev → create an API key**: Settings → n8n API → create a key. Copy it.
2. **prd → pair**: open *Promotion review* (main sidebar, between Overview and
   Personal) → **Source instances** → pair with:
   - Name: `n8n Dev`
   - Base URL: `http://n8n-dev:5678`  ← docker hostname, **not** localhost
     (the pull is backend-to-backend over the docker network)
   - API key: the key from step 1
3. **dev → build a workflow** with at least one credential (e.g. a Slack node),
   then **mark it for deployment**. There is no button yet, so trigger it from
   the dev browser console (you are already authenticated):

   ```js
   await fetch('/rest/promotion-review-prototype/producing/deployables', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     credentials: 'include',
     body: JSON.stringify({ workflowIds: ['<WORKFLOW_ID>'], targetEnv: 'prd' }),
   }).then((r) => r.json());
   ```

   `<WORKFLOW_ID>` is the id in the workflow URL (`/workflow/<id>`).
4. **prd → review**: open *Promotion review*. The request appears in the inbox
   (pulled from dev's `/outbox`). Open it → resolve credential gaps → **Approve &
   apply**. The workflow lands in the chosen prd project.

## Stop / reset

```bash
docker compose down            # stop, keep data
docker compose down -v         # stop and wipe both instances' data
```
