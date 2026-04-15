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

This build simulates real-time multiplayer using **`localStorage` + polling** (no server).

To test:

1. Open the site in one window/tab → **Create room**
2. Copy the room code
3. Open a second player in another window
   - Recommended: a different browser (Chrome + Edge), or an Incognito/InPrivate window
4. **Join room** using the code

Notes:

- This is best for testing UI/game flow and the sync logic.
- It will **not** work as true internet multiplayer between different devices, because `localStorage` does not sync between devices.

