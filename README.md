# Beatovic 👜👟

**Beatovic** is an **SSR e-commerce application** for a boutique, built with **Angular 20** (standalone components, signals, modern `@if`/`@for` blocks) and deployed on **Vercel**.  
The backend is implemented in **Spring Boot**, exposing REST APIs for products, collections, and orders.

--------------------

## 🚀 Development

Start the local dev server:

npm install
npm start
Open http://localhost:4200 in your browser.
The app will automatically reload on source file changes.

--------------------

Run with SSR locally (server-side rendering):

Copy code
npm run build:prod
npm run serve:ssr

--------------------

📦 Build
Create a production build:

Copy code
npm run build:prod

Build output is located in:

dist/Beatovic/browser → static client assets

dist/Beatovic/server/server.mjs → SSR server entrypoint

🌐 Deployment (Vercel)
This project is configured for deployment on Vercel.

In your Vercel Project Settings, set:

Build Command: npm run vercel-build

Output Directory: dist/Beatovic/browser

Install Command: npm install

Node.js Version: 20.19

The included vercel.json routes all requests to dist/Beatovic/server/server.mjs for SSR rendering.

🛠️ Project Structure
src/app/shared/ui → shared UI components (navbar, hero slider, product card, discount slider, etc.)

src/app/features → domain-specific features (catalog, cart, account, etc.)

src/styles.scss → global styles, resets, colors, and typography

src/assets → images, icons, and media (banners, promo videos, etc.)

🧪 Testing
Run unit tests:

bash
Copy code
npm test
End-to-end (e2e) testing framework is not included in this repo (planned for Cypress/Playwright).

📖 Tech Stack
Angular 20 (standalone components, signals, SSR)

NgOptimizedImage for image optimization

SCSS with modern layout techniques (CSS Grid, Flexbox, clamp, aspect-ratio)

Spring Boot backend API

🔖 Version
Current app version: 0.0.1
