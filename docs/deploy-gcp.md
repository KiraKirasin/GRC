# Deploy GRC to Google Cloud Platform (Compute Engine)

This guide deploys the NovaPay GRC pilot on **GCP Compute Engine** using Docker Compose and Caddy.

| Resource | Suggested value |
|---|---|
| Provider | Google Cloud Platform |
| Machine type | **e2-micro** (Always Free eligible) or **e2-small** |
| vCPU / RAM | **1 vCPU / 1 GB** (e2-micro) or **2 GB** (e2-small) |
| Boot disk | **30–50 GB** standard persistent disk |
| OS | **Ubuntu 22.04 LTS** |
| Public ports | **22, 80, 443** |
| App port (internal) | **3001** |
| Database | SQLite at `/data/grc.db` |
| Uploads | `/data/uploads/projects` |

**Always Free** (eligible regions only): one **e2-micro** VM per month (~750 instance-hours), 30 GB standard disk, and 1 GB egress to most regions. See [GCP Free Tier](https://cloud.google.com/free/docs/free-cloud-features).

---

## Architecture

```
Internet
   ↓
GCP VPC firewall  (22, 80, 443)
   ↓
Caddy :443 / :80
   └── reverse_proxy → app:3001
                          ├── /api/*   Express API
                          ├── /*       SPA (Vite build)
                          └── /data/grc.db + uploads  (Docker volume)
```

Single Node container serves **API + frontend**. Caddy terminates TLS and proxies everything to `app:3001`.

---

## 1. Create a GCP project and enable APIs

1. Sign in to [Google Cloud Console](https://console.cloud.google.com).
2. Create a project (e.g. `novapay-grc-pilot`).
3. Enable billing (required even for Free Tier).
4. Enable APIs:

```bash
gcloud services enable compute.googleapis.com
```

Or in the console: **APIs & Services → Enable APIs → Compute Engine API**.

---

## 2. Create the VM

### Console

1. **Compute Engine → VM instances → Create instance**.
2. Name: `grc-pilot`.
3. Region: pick an **Always Free** region if using e2-micro (`us-west1`, `us-central1`, `us-east1`).
4. Machine type: **e2-micro** (1 vCPU, 1 GB) or **e2-small** (2 GB RAM recommended for builds).
5. Boot disk: **Ubuntu 22.04 LTS**, **30–50 GB** standard persistent disk.
6. Firewall: check **Allow HTTP traffic** and **Allow HTTPS traffic**.
7. SSH keys: add your public key under **Security → SSH Keys**.
8. Create.

### gcloud CLI

```bash
export PROJECT_ID=novapay-grc-pilot
export ZONE=us-central1-a
export VM_NAME=grc-pilot

gcloud config set project "$PROJECT_ID"

gcloud compute instances create "$VM_NAME" \
  --zone="$ZONE" \
  --machine-type=e2-small \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-standard \
  --tags=http-server,https-server
```

### Reserve a static external IP (recommended)

```bash
gcloud compute addresses create grc-pilot-ip --region=us-central1

gcloud compute instances delete-access-config "$VM_NAME" \
  --zone="$ZONE" --access-config-name="External NAT"

gcloud compute instances add-access-config "$VM_NAME" \
  --zone="$ZONE" \
  --access-config-name="External NAT" \
  --address="$(gcloud compute addresses describe grc-pilot-ip --region=us-central1 --format='get(address)')"
```

Note the **external IP** for DNS and SSH.

---

## 3. Firewall rules

Default **http-server** and **https-server** tags open ports 80 and 443. Add SSH (restrict to your IP when possible):

```bash
gcloud compute firewall-rules create allow-ssh-grc \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:22 \
  --source-ranges=YOUR_IP/32 \
  --target-tags=grc-ssh
```

Tag the VM for SSH if you use a custom rule:

```bash
gcloud compute instances add-tags "$VM_NAME" --zone="$ZONE" --tags=grc-ssh
```

Do **not** open port **3001** publicly. Only Caddy (80/443) should be reachable from the internet.

---

## 4. First SSH and host bootstrap

```bash
gcloud compute ssh "$VM_NAME" --zone="$ZONE"
# or: ssh -i ~/.ssh/google_compute_engine YOUR_USER@EXTERNAL_IP
```

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git ufw

# Host firewall — keep GCP VPC rules in sync
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Docker (official)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker

docker version
docker compose version
```

Re-login if `docker` permission is denied.

---

## 5. Get the application code onto the VM

### Option A — Git clone (recommended)

```bash
cd ~
git clone https://github.com/KiraKirasin/GRC grc
cd grc
```

### Option B — SCP / rsync from laptop

```bash
# on your laptop
rsync -avz --exclude node_modules --exclude dist --exclude .git \
  -e "gcloud compute ssh --zone=$ZONE --" \
  ./ "$VM_NAME:~/grc/"
```

---

## 6. Configure domain / TLS

### With a real domain (recommended)

1. Create an **A record**: `grc.yourdomain.com → EXTERNAL_IP`
   - Use [Cloud DNS](https://cloud.google.com/dns) or your registrar.
2. Set the domain for Caddy:

```bash
cd ~/grc
echo 'GRC_DOMAIN=grc.yourdomain.com' > .env.deploy
```

Caddy obtains a Let’s Encrypt certificate when ports 80/443 are reachable.

### IP-only pilot (no domain yet)

Use HTTP on port 80. Temporary Caddyfile:

```bash
cat > deploy/Caddyfile <<'EOF'
:80 {
	encode gzip
	reverse_proxy app:3001
}
EOF
```

Add HTTPS later when DNS is ready.

---

## 7. Build and start

Build on the VM’s native architecture (e2 is **x86_64**; do not force `platform: linux/arm64` on Intel/AMD VMs).

From the project root:

```bash
cd ~/grc

export $(grep -v '^#' .env.deploy 2>/dev/null | xargs) || true

docker compose build
docker compose up -d
docker compose ps
docker compose logs -f app
```

Health check:

```bash
curl -s http://127.0.0.1:3001/api/health
# expect: {"ok":true}

curl -sI https://grc.yourdomain.com/api/health
```

Data layout inside the volume:

```
/data/grc.db
/data/uploads/projects/...
```

---

## 8. What the Docker setup does

| File | Role |
|---|---|
| `Dockerfile` | Multi-stage build: `node:22-bookworm-slim`, Vite build, Prisma generate, run on **3001** |
| `docker-compose.yml` | `app` + `caddy`, volume `grc-data` → `/data` |
| `deploy/Caddyfile` | TLS + reverse proxy to `app:3001` |
| `.dockerignore` | Keeps image small |

Runtime environment (set in Compose):

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=file:/data/grc.db
UPLOAD_DIR=/data/uploads/projects
```

On start, the container runs:

```bash
npx prisma migrate deploy && npx tsx server/index.ts
```

Express serves `/api/*` and the built SPA from `dist/`.

---

## 9. Seed / import controls (first launch)

After the API is healthy:

```bash
docker compose exec app sh

npx tsx prisma/import-controls.ts
npx tsx prisma/import-pci-controls.ts
exit
```

If the Excel file is not in the image:

```bash
docker compose cp "NovaPay_Enterprise_Control_Library (1).xlsx" app:/app/
docker compose exec app npx tsx prisma/import-controls.ts
docker compose exec app npx tsx prisma/import-pci-controls.ts
```

---

## 10. Hardening checklist (pilot)

- [ ] SSH limited to your IP in GCP firewall rules
- [ ] Port **3001** not publicly open
- [ ] HTTPS working (domain + Caddy)
- [ ] Regular backup of Docker volume / SQLite file
- [ ] Optional: [Identity-Aware Proxy](https://cloud.google.com/iap) or VPN for private access

### Backup SQLite

```bash
docker compose exec app sh -c 'cp /data/grc.db /data/grc-$(date +%F).db'
docker compose cp app:/data/grc.db ./grc-backup.db
```

Or create a **disk snapshot** in Compute Engine:

```bash
gcloud compute disks snapshot DISK_NAME \
  --zone="$ZONE" \
  --snapshot-names=grc-$(date +%F)
```

---

## 11. Updates / redeploy

### Manual

```bash
cd /opt/grc   # or ~/grc on older installs
git pull
docker compose build
docker compose up -d
docker compose logs -f app
```

Persistent data stays in the `grc-data` volume across rebuilds.

### GitHub Actions CI/CD (preferred)

Workflow: [`.github/workflows/grc-ci-cd.yml`](../.github/workflows/grc-ci-cd.yml)

Pipeline on `main` / PRs:

1. **quality** — `npm ci`, Prisma generate, build  
2. **opengrep** — OpenGrep SAST (escape hatch `always() && !cancelled()`; soft `continue-on-error`)  
3. **image** — Docker build, CycloneDX SBOM, Trivy soft step, upload immutable image (escape hatch)  
4. **deploy** — escape hatch always runs; production VM steps only on push to `main`  
5. **e2e** — escape hatch always runs; Playwright against `APP_URL` only on push to `main`  

Dependent jobs use the GitHub Actions escape hatch (`if: always() && !cancelled()`) so upstream failures do not transitively **Skip** later jobs.

This workflow replaces the former standalone `google.yml`, `sbom-trivy.yml`, and `snyk-security.yml`. Keep [`.github/workflows/codeql.yml`](../.github/workflows/codeql.yml) for CodeQL.

Deploy target defaults: VM `grc-pilot`, zone `us-central1-a`, path `/opt/grc`, health URL `http://136.112.38.75/api/health`.

#### Required GitHub configuration

| Kind | Name | Purpose |
|---|---|---|
| Variable | `GCP_PROJECT_ID` | GCP project id (Actions → Variables; required — empty shows as blank in logs) |
| Secret | `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/.../locations/global/workloadIdentityPools/.../providers/...` |
| Secret | `GCP_SERVICE_ACCOUNT` | SA email used by Actions (Compute OS Login / SSH + instance access) |
| Environment | `production` | Used by the deploy job on `main`. If you store secrets on the environment, put the two GCP secrets there (repo-level secrets also work). |

The deploy job fails fast with a clear error when any of these are missing (empty `${{ secrets.* }}` makes `google-github-actions/auth` report “must specify exactly one of workload_identity_provider or credentials_json”).

OIDC (Workload Identity Federation) setup outline:

```bash
# Enable IAM Credentials + STS APIs, create WIF pool/provider for GitHub,
# bind roles/compute.instanceAdmin.v1 (and OS Login / IAP as needed) to the SA,
# then store the provider resource name and SA email as repo secrets.
```

See [google-github-actions/auth](https://github.com/google-github-actions/auth) for the full WIF recipe.

First-time VM layout expected by the workflow:

```bash
sudo mkdir -p /opt/grc/deploy
# Docker + Docker Compose plugin installed
# Service account / OS Login allows gcloud compute ssh from the Actions SA
```

---

## 12. Prisma / architecture notes

- Base image: **`node:22-bookworm-slim`** (multi-arch).
- `prisma generate` runs inside the image for the VM’s CPU architecture.
- **e2-micro** has 1 GB RAM — first `docker compose build` may be slow; consider **e2-small** for smoother builds, then resize down if needed.
- For **ARM** VMs (e.g. **T2A** / Ampere), use the same Compose stack; do not force `platform: linux/amd64`.

---

## 13. Troubleshooting

| Symptom | Check |
|---|---|
| Cannot SSH | Firewall rule for tcp:22; IAP or correct SSH key; VM running |
| Caddy TLS fails | DNS A record; ports 80/443 open in **GCP firewall** and UFW |
| `{"ok":true}` on VM but site down | `docker compose logs caddy` |
| Empty controls | Run import scripts (section 9) |
| Prisma migrate errors | `docker compose logs app`; ensure `/data` is writable |
| OOM during build | Use e2-small or add swap temporarily |

```bash
docker compose logs --tail=200 app
docker compose logs --tail=200 caddy
curl -s http://127.0.0.1:3001/api/health
df -h
free -h
```

---

## 14. Cost notes

| Tier | Notes |
|---|---|
| **Always Free** | e2-micro in `us-west1`, `us-central1`, `us-east1`; 30 GB disk; limited egress |
| **e2-small** | Low cost (~$12–15/mo) if Free Tier is too tight for builds |
| **Static IP** | Free while attached to a running VM; charged if reserved but unused |

This stack fits a pilot: one small VM, SQLite on disk, HTTPS reverse proxy, no managed Postgres/Redis.

---

## Quick command cheat sheet

```bash
gcloud compute ssh grc-pilot --zone=us-central1-a
cd ~/grc
docker compose up -d --build
docker compose ps
curl -s http://127.0.0.1:3001/api/health
docker compose exec app npx tsx prisma/import-pci-controls.ts
```

Open in browser: `https://grc.yourdomain.com` (or `http://EXTERNAL_IP` in HTTP-only mode).
