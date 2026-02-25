# SolidStart

Everything you need to build a Solid project, powered by [`solid-start`](https://start.solidjs.com);

## Creating a project

```bash
# create a new project in the current directory
npm init solid@latest

# create a new project in my-app
npm init solid@latest my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

Solid apps are built with _presets_, which optimise your project for deployment to different environments.

By default, `npm run build` will generate a Node app that you can run with `npm start`. To use a different preset, add it to the `devDependencies` in `package.json` and specify in your `app.config.js`.

## This project was created with the [Solid CLI](https://github.com/solidjs-community/solid-cli)

## E2E (Playwright)

Category regression coverage lives in:

- `e2e/category-regressions.spec.ts`

Setup:

```bash
cp .env.e2e.example .env.e2e
```

Run:

```bash
source .env.e2e
npm install
npm run e2e:install
npm run e2e
```

## Demo mode (mocked backend)

Run or build the webmail with in-memory mocked data and no auth/DB dependencies:

```bash
WEBMAIL_DEMO_MODE=true npm run dev
WEBMAIL_DEMO_MODE=true npm run build
```

Demo credentials:

- Email: `demo@homerow.dev`
- Password: `demo123`

In demo mode, mailbox state is reset on full page reload to keep demos deterministic.

## Static Demo Build (GitHub Pages)

Build the actual webmail app in demo mode as a static bundle (no backend) and copy it to `docs/public/webmail-demo`:

```bash
npm run build:demo-static
```

After docs deployment, it will be available at `/webmail-demo/`.
