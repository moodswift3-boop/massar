# SwiftMedia deployment notes

SwiftMedia has two deployment modes:

- **GitHub Pages:** serves the static storyboard UI only. It cannot execute `api/videos.js`.
- **Vercel:** serves the static site and the serverless API route `/api/videos`.

## Enable real MP4 rendering

1. Import `moodswift3-boop/massar` into a Vercel project.
2. In Vercel → Project → Settings → Environment Variables, add `JSON2VIDEO_API_KEY` with the API key from JSON2Video. Add it to the Production environment (and Preview if desired). Do not commit the key.
3. Deploy the project on Vercel.
4. Open `/swiftmedia.html` on the Vercel deployment and click **إنتاج فيديو فعلي عبر API**.

The UI calls:
- `POST /api/videos` to submit a video render.
- `GET /api/videos?project=...` to poll the render status.

The API uses JSON2Video's public `POST /v2/movies` and `GET /v2/movies?project=...` endpoints. It creates a title scene, Arabic text-to-speech narration, and Arabic subtitles. The first implementation uses typography-led scenes; custom stock footage, generated illustrations, music, and final branded motion graphics should be added after the first end-to-end render is verified.

## Important

- Do not put `JSON2VIDEO_API_KEY` in HTML, browser JavaScript, or any public GitHub file.
- Rendering can consume account credits. Test with a short script first.
- The Arabic voice configured in the first version is `ar-EG-SalmaNeural`. If the provider account/voice catalogue does not support it, change it to an available Arabic Azure voice.
- The repository does not contain any API key. A project owner with access to the Vercel account must add the secret and deploy.
