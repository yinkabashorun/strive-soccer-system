# native/: the Strive Elite iPhone app

A Capacitor 8 shell around https://thestriveapp.com. The app itself lives
in the rest of this repository; this folder only wraps it and adds native
push, haptics and an offline screen.

Nothing here has been compiled yet (no Apple Developer account). The full
checklist, the open decisions and what each secret is for:
`docs/app-store/README.md`.

- `capacitor.config.ts`: what the shell opens and how.
- `www/`: the two bundled pages (a black first frame, the offline screen).
- `ios/`: the Xcode project (generated with `npx cap add ios`).
- Build and upload: GitHub > Actions > "iOS to TestFlight" > Run workflow.

After changing `capacitor.config.ts`, `www/` or a plugin: `npm install`
then `npm run sync` in this folder, and commit what changes under `ios/`.

Never commit a `.p8` key, a certificate or a provisioning profile.
