# PlanetSport production deployment

This is the production runbook for the Angular SSR storefront at
`https://planet-sport.net/`. The application is served by the existing `frontend`
Docker service, whose Node SSR server listens on container port `4000`. Docker
publishes it only on host loopback as `127.0.0.1:4000`; the public entry point is the
reverse proxy.

```text
Internet -> HTTPS reverse proxy -> 127.0.0.1:4000 -> Angular SSR
                                      |
                                      +-> configured backend API/media services
```

The reverse proxy must forward every Angular page request, including nested routes,
to the SSR server. This is not a static-only Angular deployment, so do not replace the
SSR proxy with `try_files ... /index.html`.

## Production domain and runtime configuration

The canonical public origin is `https://planet-sport.net/`. Production canonicals,
Open Graph URLs, JSON-LD URLs, `robots.txt`, and `sitemap.xml` all derive from the
runtime `SITE_URL`; they are not compiled into the Angular bundle.

Copy the tracked template and set deployment values:

```bash
cp .env.example .env
```

Required/current values:

- `BE_HOSTNAME=planet-sport.net` sets `SITE_URL=https://planet-sport.net` in Compose.
  The existing Compose setup also derives API and media URLs from this hostname.
- `APP_HOST_CONTEXT_PATH` is the deployed backend application context, without
  leading or trailing slashes. Confirm it with the backend/DevOps owner; do not guess.
- `TURNSTILE_SITE_KEY` is the public Cloudflare Turnstile site key registered for the
  production hostname. It is not a secret.
- `PORT=4000` is the existing SSR port.
- Keep `MAINTENANCE_MODE=false` for the Coming Soon workflow described below. That
  workflow is controlled by Nginx, not by rebuilding or changing Angular.
- `MAINTENANCE_MESSAGE` applies only to the application's separate runtime maintenance
  component and can remain empty for the proxy-controlled Coming Soon workflow.

At container start, `scripts/write-runtime-config.cjs` writes the validated values to
`dist/Beatovic/browser/runtime-config.js`. `API_BASE_URL`,
`MEDIA_PRODUCT_BASE_URL`, and `SITE_URL` remain separate runtime settings inside the
application. Local `ng serve` continues to use the development proxy and localhost
configuration from `proxy.conf.cjs`.

If the backend or media service is hosted on a different production origin, preserve
that separation: set `API_BASE_URL` and `MEDIA_PRODUCT_BASE_URL` to the real service
origins in the deployment environment/run command instead of changing public-site SEO
URLs. The current Compose convention assumes those services are exposed below
`https://planet-sport.net/`.

## DNS and canonical hostname

Create the appropriate DNS records so both `planet-sport.net` and
`www.planet-sport.net` resolve to the production reverse proxy/load balancer. The
actual record type, address, and TTL depend on the infrastructure and are intentionally
not stored here.

Use `https://planet-sport.net/` as the only canonical hostname. If `www` is enabled,
redirect it permanently while preserving the path and query string:

```nginx
server {
  listen 443 ssl;
  server_name www.planet-sport.net;

  # Certificate directives are managed by the platform/ACME client, not this repo.
  return 301 https://planet-sport.net$request_uri;
}
```

## HTTPS / SSL

Terminate HTTPS at Nginx or the production load balancer. Never commit certificates,
private keys, or ACME account credentials. Redirect plain HTTP to the canonical HTTPS
origin after the certificate is active:

```nginx
server {
  listen 80;
  listen [::]:80;
  server_name planet-sport.net www.planet-sport.net;

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location / {
    return 301 https://planet-sport.net$request_uri;
  }
}
```

On an Nginx host using Certbot, the initial repository config can be installed first,
then the certificate and redirect can be configured with:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d planet-sport.net -d www.planet-sport.net
sudo nginx -t
sudo systemctl reload nginx
```

Confirm automatic certificate renewal according to the host's operating procedures.

## Build and run the existing Docker image

The existing image naming convention is `igorpopovicc/beatovic:latest`. Build a Linux
AMD64 image with the repository Dockerfile:

```bash
docker buildx build --platform linux/amd64 -t igorpopovicc/beatovic:latest --load .
```

Start or replace the existing Compose service:

```bash
docker compose up -d frontend
docker compose ps
curl -i http://127.0.0.1:4000/healthz
```

The expected health response is HTTP `200` with `{"status":"ok"}`. The container
entrypoint fails fast if a required URL or Turnstile value is absent or invalid. To
inspect startup failures:

```bash
docker compose logs --tail=200 frontend
```

For a published image deployment instead of a host build:

```bash
docker compose pull frontend
docker compose up -d frontend
```

## Nginx reverse proxy and nested Angular routes

The repository template is `deploy/nginx/beatovic.conf`. Install it, provision HTTPS
as described above, and validate before reloading:

```bash
sudo cp deploy/nginx/beatovic.conf /etc/nginx/sites-available/beatovic.conf
sudo ln -s /etc/nginx/sites-available/beatovic.conf /etc/nginx/sites-enabled/beatovic.conf
sudo nginx -t
sudo systemctl reload nginx
```

The catch-all `location /` sends the original URI to the Angular SSR process. That is
the SSR equivalent of an SPA fallback and is required for direct requests and refreshes
on routes such as `/products`, `/catalog/...`, `/product/...`, `/admin/...`, and the
exact `/test/comming-soon` route.

The proxy preserves the request authority and protocol using the headers already in
the template:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

If API/media endpoints share this virtual host, keep their existing explicit Nginx
locations above the frontend `location /`. In particular, route the configured
`/<APP_HOST_CONTEXT_PATH>/api` and `/media/product` paths to the actual backend/media
upstreams. Do not point those locations to Angular SSR. The maintenance matcher only
redirects GET/HEAD requests that accept HTML, so ordinary JSON API calls are not
redirected; explicit backend locations remain the preferred and unambiguous setup.

## Coming Soon maintenance switch

The Angular page remains at the exact, intentionally spelled route
`/test/comming-soon`. `/` remains the normal storefront in application source.

The top-level `map` in `deploy/nginx/beatovic.conf` is the external switch:

```nginx
map "$request_method:$http_accept" $maintenance_redirect {
  default 0;
  ~*^(GET|HEAD):.*text/html 0;
}
```

The exact Coming Soon, health, runtime-config, robots, sitemap, and admin locations
bypass the redirect. Angular JS/CSS, source maps, manifests, favicon, images, fonts,
and other static assets also bypass it. The catch-all redirects only browser HTML
navigations, which avoids redirecting normal API requests and avoids a redirect loop.

### Maintenance ON

Change only the final `0` on the HTML matcher to `1` in the installed Nginx config:

```nginx
~*^(GET|HEAD):.*text/html 1;
```

Then validate and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Public HTML navigations now receive a temporary `302` to
`/test/comming-soon`. The exact route is proxied to Angular SSR and remains accessible.
No frontend image rebuild or container restart is required.

### Maintenance OFF

Change the matcher back to:

```nginx
~*^(GET|HEAD):.*text/html 0;
```

Then validate and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

The normal storefront is restored immediately, again without an Angular rebuild.

Do not remove the `/healthz`, `/runtime-config.js`, asset, or exact Coming Soon bypass
locations. If additional monitoring/internal paths must remain accessible, add their
explicit proxy locations above `location /`. The supplied config keeps `/admin` and
`/admin/**` available behind the application's existing authentication. If APIs share
the host, confirm their explicit locations before enabling maintenance.

## Caching

- `runtime-config.js` is explicitly `no-store`; it contains deployment values written
  at container start and must never receive the static immutable policy.
- Hashed Angular JS/CSS and proxied static assets receive the existing 30-day public,
  immutable policy in the Nginx template.
- SSR HTML is handled by `location /` and receives no immutable cache header. Do not
  add long-lived caching to SSR HTML or a static `index.html`.
- `robots.txt` and `sitemap.xml` use dedicated dynamic SSR endpoints and bypass the
  immutable asset location.
- No Angular service worker is configured in `angular.json`; do not add service-worker
  caching as part of deployment.

## Production response headers

Keep the forwarded headers shown above. Apply security headers at the public HTTPS
proxy only after verifying third-party integrations such as Google Fonts and
Cloudflare Turnstile. Recommended low-risk headers include `X-Content-Type-Options:
nosniff` and an appropriate `Referrer-Policy`. Enable HSTS only after HTTPS works on
all supported hostnames. Do not introduce a restrictive Content Security Policy
without testing every required source.

## Validation checklist

Normal mode:

```bash
curl -I -H 'Accept: text/html' https://planet-sport.net/
curl -I -H 'Accept: text/html' https://planet-sport.net/products
curl -I -H 'Accept: text/html' https://planet-sport.net/test/comming-soon
curl -s https://planet-sport.net/robots.txt
curl -s https://planet-sport.net/sitemap.xml | head
```

Confirm `/` is the storefront, nested routes return SSR HTML, canonicals and social
URLs use `https://planet-sport.net`, the Coming Soon response contains `noindex`, and
robots/sitemap contain the production origin.

Maintenance mode:

```bash
curl -I -H 'Accept: text/html' https://planet-sport.net/
curl -I -H 'Accept: text/html' https://planet-sport.net/test/comming-soon
curl -i https://planet-sport.net/healthz
curl -I https://planet-sport.net/runtime-config.js
```

Expected: `/` returns `302` with `Location: /test/comming-soon`; the exact Coming Soon
route and health endpoint do not redirect; `runtime-config.js` remains loadable and
non-cacheable. In a browser, verify that the Coming Soon page has its CSS, images, and
fonts and has no console or network errors. Switch maintenance OFF and verify `/`
immediately returns the normal storefront.

After each application deployment, smoke-test home, product listing/filter/search,
one direct product URL and refresh, cart, checkout, login/account if enabled, and the
authenticated admin area. These flows depend on live backend data and credentials and
must be validated against the deployed backend by the responsible release owner.
