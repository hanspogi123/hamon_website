# hamon_website

Static GitHub Pages site for **HAMON — Real-Time Multiplayer**.

## GitHub Pages setup

1. Go to your repo on GitHub → **Settings** → **Pages**
2. Under **Build and deployment**
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/ (root)`
3. Save, then wait for GitHub to publish.

Your site will be available at:

- `https://hanspogi123.github.io/hamon_website/`

## How to test the “multiplayer”

This project supports:

- **Local mode**: simulated real-time using **`localStorage` + cross-tab events** (no server).
- **Online mode**: real multiplayer using a **WebSocket server** (works across devices).

To test:

1. Open the site in one window/tab → **Create room**
2. Copy the room code
3. Open a second player in another window
   - Recommended: a different browser (Chrome + Edge), or an Incognito/InPrivate window
4. **Join room** using the code

Notes:

- Local mode is best for testing UI/game flow quickly.
- Online mode is required for true internet multiplayer (different devices).

## Deploy the WebSocket server (Render)

This repo includes `render.yaml` for one-click-ish deployment.

1. Create a Render account, then click **New** → **Blueprint**
2. Select this GitHub repository
3. Deploy

After deploy, Render will give you a URL like:

- `https://hamon-multiplayer-ws-xxxx.onrender.com`

For the game, you must use **WSS**:

- `wss://hamon-multiplayer-ws-xxxx.onrender.com`

### Open the game in online mode

Use query params:

- `hamon_multiplayer.html?online=1&server=wss://hamon-multiplayer-ws-xxxx.onrender.com`


