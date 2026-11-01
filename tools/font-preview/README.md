# Font preview


Run `npm run font-preview` from the repository root, then open
`http://localhost:8081/` to compare fonts in sample Collection Browser,
desktop in-game toolbar and VM/E Shell views. This starts a separate Vite server;
the main VM/E development server is not required.

For HTTPS and testing on a phone or tablet, run `npm run font-preview:https`.
It uses the existing development certificate in `certs/dev-cert.pem` and
`certs/dev-key.pem`. Open `https://<your-computer-address>:8081/` on a device
that trusts that certificate. The port can be overridden with `-- --port 8082`.

The tool's HTML, scripts, sample data and styles all live in this directory.
Its Vite configuration imports application components directly from `src/`.
The page uses the actual components, markup and styles with generated images and in-memory settings.
It does not open the VM/E database or change application preferences.

Choose from 55 Google Fonts grouped by style, or enter another family, compare it with Avenir,
and switch between grid/coverflow, desktop toolbar, gamepad shell and its VR canvas.
Phone/tablet viewport presets are shown at 1:1 scale. The VR preview uses the actual
1024 × 768 shell painter; font changes repaint its text as well as the DOM views.
In the shell, click rows or use arrows, Enter, Escape and X (keyboard/list).
The URL keeps the selected font and preview options for bookmarking.
Google Fonts requires an internet connection; a loading error keeps the previous
font visible. Custom families must provide weights 400, 500, 600 and 700 through
the [Google Fonts CSS API](https://developers.google.com/fonts/docs/css2).
The production commands (`build`, `build:server`, `build:gh` and `deploy`) use
the root Vite configuration and include only the application. The preview has no
PWA or deployment configuration, and its own configuration rejects builds.
