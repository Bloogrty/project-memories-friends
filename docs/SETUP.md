# Setup guide

These are the MVP steps that need your phone, NAS, or accounts. The NAS side (shared folder, `memories-app` user, WebDAV, Tailscale Funnel) is already done, so what's left is testing and deploying.

## Step 3: Test on your phone over Wi-Fi

**Why:** camera capture behaves differently on a real phone than on a desktop browser.

1. Connect your laptop and phone to the same Wi-Fi.
2. Start the app. It finds your laptop's Wi-Fi address by itself:
   ```powershell
   npm run dev:phone
   ```
3. If Windows Firewall asks, allow Node.js on **private** networks.
4. On your phone, open the `https://...:3000` address printed in the terminal.
5. The first time, the browser warns that the connection isn't private. That's expected for this local test, because the certificate is one the project made for itself. Tap **Advanced**, then **Proceed** (on iPhone, **Show Details**, then **visit this website**). Only do this for your own laptop's address.
6. If the page doesn't load, turn off any VPN such as Cloudflare WARP for a moment.
7. Check that:
   - **Take photo** opens the in-app camera, and each tap saves a photo with no "Use photo" step
   - the photo appears in the gallery the right way up, and the counter goes up
   - a second phone sees the photo within about 10 seconds

Photos are saved to `.local-storage/` in the project folder.

**Why HTTPS:** browsers only allow the in-app camera on HTTPS or `localhost`. On a plain `http://` address the app falls back to the phone's own camera, which always asks "Use photo", and video doesn't work.

## Step 4: Test the app against the real NAS from your laptop

**Why:** this proves the app can talk to the NAS through the Funnel, before Vercel adds more things that could go wrong.

1. Open `.env.local` and set these values. This file is ignored by Git, so the real URL and password stay out of the repo:
   ```
   STORAGE_DRIVER=webdav
   WEBDAV_URL=https://<nas>.<tailnet>.ts.net
   WEBDAV_USERNAME=memories-app
   WEBDAV_PASSWORD=<the password>
   WEBDAV_ROOT=/project__memories
   ```
   `WEBDAV_URL` has no port, because the Funnel listens on the standard HTTPS port 443.
2. Restart `npm run dev` so it reads the new values.
3. Open the app and take a photo.
4. In DSM **File Station**, open `project__memories`. You should see a folder named with today's date, containing `full/`, `thumb/`, and `guests/`.

To delete a test photo, use `/admin` rather than File Station, so the full photo and its thumbnail are removed together.

## Step 5: Deploy to Vercel

1. Create a GitHub repository and push this project. Vercel treats `main` as production, and this repo is currently on `master`, so rename it first:
   ```powershell
   git branch -m main
   ```
2. In [Vercel](https://vercel.com), choose **Add New > Project** and import the repository. It detects Next.js automatically.
3. Before deploying, add these under **Environment Variables**:

   | Variable | Value |
   |---|---|
   | `STORAGE_DRIVER` | `webdav` |
   | `WEBDAV_URL` | `https://<nas>.<tailnet>.ts.net` |
   | `WEBDAV_USERNAME` | `memories-app` |
   | `WEBDAV_PASSWORD` | the `memories-app` password |
   | `WEBDAV_ROOT` | `/project__memories` |
   | `ADMIN_SECRET` | a new random secret of 16+ characters, different from your local one |

   Everything else has a default. See `.env.example` for the full list.
4. Deploy. Then open **Settings > Functions** and set the region to **Singapore (sin1)**. **Why:** it is close to your NAS, which makes uploads and gallery loads faster. Redeploy afterwards so it takes effect.
5. Test on your phone over mobile data: open the `*.vercel.app` URL, take a photo, then check that it appears in File Station.
6. Tap **Video**, allow the camera and microphone, and record a clip. Check that it uploads and plays in the gallery. Try this on both an iPhone and an Android phone if you can, because they record in different ways.

Redeploy after changing any variable. `NEXT_PUBLIC_` values in particular are built into the app.

## Admin

Open `/admin`, then enter your `ADMIN_SECRET` and a Day code such as `2026-11-07`. You can delete photos and close a Day early.

Closing is recorded in `<day_code>/day.json` on the NAS. There is no reopen button: to reopen a Day, delete the `closed_at` line from that file.

## Logs

Logs appear in the `npm run dev` terminal locally, and under **Vercel > Logs** in production. Two settings control them:

| Setting | What it does |
|---|---|
| `LOG_ENABLED=false` | Turns off all logs, including errors |
| `LOG_LEVEL=debug` | Shows everything: gallery polling, image loads, and how long each NAS call takes. Use it when something is slow or failing |
| `LOG_LEVEL=info` | The default: uploads, guests joining, admin actions, rejected requests, and errors |
| `LOG_LEVEL=warn` | Only rejected requests and errors |
| `LOG_LEVEL=error` | Only server errors |

Restart `npm run dev` after changing `.env.local`. On Vercel, redeploy after changing a variable.

## If something goes wrong

| What you see | Likely cause |
|---|---|
| "Can't reach the album" | The app can't reach the NAS, or the env is invalid. Check the terminal locally, or **Vercel > Logs** |
| Every API call returns an error | Invalid env. The log line starts with `Invalid environment configuration` and names the variable |
| It worked before, and now every call fails | The Funnel or NAS is down. Open the `WEBDAV_URL` from a phone on mobile data: you should get a login prompt |
| Logs show 401 from the NAS | Wrong `WEBDAV_USERNAME` or `WEBDAV_PASSWORD`. Fix it quickly, because repeated failures may trigger DSM's Auto Block. All Funnel traffic can look like it comes from one address, so a block could cut off the whole app |
| Logs show 403 or 404 from the NAS | `WEBDAV_ROOT` is wrong (it has a double underscore), or `memories-app` lacks Read/Write on the folder |
