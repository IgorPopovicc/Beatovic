# Hetzner Production Deployment (Angular SSR)

This project is an Angular 20 SSR app. The production path below keeps SSR enabled, so product URLs can return SEO/Open Graph metadata in initial HTML.

## Chosen architecture

Internet -> Nginx (HTTPS on host) -> Docker container (Angular SSR Node server on `127.0.0.1:4000`) -> Backend API

Why this approach:
- Preserves Angular SSR behavior.
- Keeps deployment simple and predictable on a Hetzner VPS.
- Nginx handles public traffic, TLS, compression, and proxy headers.
- App runs isolated in Docker with reproducible builds.

## 1) Server prerequisites (Ubuntu)

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release git nginx
```

Install Docker + Compose plugin (official Docker repository):

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and back in so your user can run Docker without `sudo`.

## 2) Get code on server

```bash
git clone <YOUR_REPO_URL> beatovic
cd beatovic
```

## 3) Configure production environment

Create `.env` from the template:

```bash
cp .env.example .env
```

Update values in `.env`:

- `BE_HOSTNAME`: public backend/frontend hostname without a protocol
- `APP_HOST_CONTEXT_PATH`: backend application context path without leading/trailing slashes
- `TURNSTILE_SITE_KEY`: public Cloudflare Turnstile site key for this frontend hostname
- `MAINTENANCE_MODE`: optional runtime switch; set to `true` to return the maintenance page
- `MAINTENANCE_MESSAGE`: optional customer-facing maintenance message
- `PORT`: SSR container port (default `4000`)

Important:
- Do not set localhost values for public production URLs.
- Compose derives `API_BASE_URL`, `MEDIA_PRODUCT_BASE_URL`, and `SITE_URL` from these values.
- The container writes them to `runtime-config.js` when it starts; changing them does not rebuild Angular or the image.
- During maintenance, public routes return HTTP `503`; `/admin/**` remains available behind its normal authentication.

## 4) Build and run SSR app (Docker)

```bash
docker build -t igorpopovicc/beatovic:latest .
docker compose up -d frontend
docker compose ps
```

The local image is tagged as `igorpopovicc/beatovic:latest`.

Health check:

```bash
curl -i http://127.0.0.1:4000/healthz
```

Expected: HTTP 200 with `{"status":"ok"}`.

## 5) Configure Nginx reverse proxy

Copy the provided config:

```bash
sudo cp deploy/nginx/beatovic.conf /etc/nginx/sites-available/beatovic.conf
```

Edit domain names (`server_name`) in `/etc/nginx/sites-available/beatovic.conf`:
- replace `example.com` and `www.example.com` with your real domain.

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/beatovic.conf /etc/nginx/sites-enabled/beatovic.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 6) Enable HTTPS (Let's Encrypt / Certbot)

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Issue certificates:

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

Certbot will update Nginx config and set up auto-renewal.

Verify renewal timer:

```bash
systemctl list-timers | grep certbot
```

## 7) Update and restart deployment

```bash
cd /path/to/beatovic
git pull
docker build -t igorpopovicc/beatovic:latest .
docker compose up -d frontend
```

If this server should always run the published Docker Hub image:

```bash
docker compose pull frontend
docker compose up -d frontend
```

## 8) Logs and troubleshooting

App logs:

```bash
docker compose logs -f frontend
```

Nginx logs:

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## 9) Validation checklist after deploy

1. Home page loads directly.
2. `/products` loads.
3. `/products?search=nike` loads.
4. Product direct URL loads (`/product/<id>`).
5. Browser refresh works on product details route.
6. Back/forward navigation works.
7. Navbar search -> "Pogledaj sve" works.

SSR check:

```bash
curl -s https://example.com/product/<id> | head -n 60
```

Confirm initial HTML contains:
- `<title>...`
- `meta name="description"`
- `meta property="og:title"`
- `meta property="og:description"`
- `meta property="og:image"` (absolute URL)
- `meta property="og:url"`
- `meta name="twitter:card"`

Optional OG preview checks:
- Meta/Facebook Sharing Debugger
- WhatsApp direct share test to a chat

## 10) Non-Docker fallback (optional)

If you must run without Docker:

```bash
npm ci
npm run build:ssr
export NODE_ENV=production
export PORT=4000
export API_BASE_URL=https://example.com/context/api
export MEDIA_PRODUCT_BASE_URL=https://example.com/media/product
export SITE_URL=https://example.com
export TURNSTILE_SITE_KEY=replace-with-site-key
export MAINTENANCE_MODE=false
export MAINTENANCE_MESSAGE=
node scripts/write-runtime-config.cjs
node dist/Beatovic/server/server.mjs
```

Then keep the same Nginx reverse proxy to `127.0.0.1:4000`.

Use systemd/pm2 only if needed; Docker remains the recommended path for this repo.

## Notes specific to this repo

- SSR entrypoint: `dist/Beatovic/server/server.mjs`
- Build command: `npm run build:ssr` (production build)
- Start command: `npm run start:ssr`
- App exposes health endpoint: `GET /healthz`
- Runtime browser configuration: `GET /runtime-config.js` (generated on each container start and served with `no-store`)
- Product SEO/OG tags are generated server-side via existing SEO services and product resolver data.
