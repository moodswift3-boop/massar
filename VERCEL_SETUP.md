# SwiftMedia on Vercel

This repository is a static Arabic learning site plus a Vercel serverless endpoint for SwiftMedia. GitHub Pages cannot run `api/videos.js`; deploy this repository to Vercel to enable the API route.

## 1. Import the repository

1. Sign in to [Vercel](https://vercel.com/).
2. Choose **Add New → Project**.
3. Import `moodswift3-boop/massar` from GitHub and authorize GitHub access if prompted.
4. For the first deployment, choose the branch `feature/swiftmedia-video-studio` so you can test before merging.
5. Keep the project root at the repository root. This is a static HTML project; no build command is required. If Vercel asks, set the output directory to `.` and leave the build command blank.
6. Deploy the project.

## 2. Add the provider key safely

In the Vercel project, open **Settings → Environment Variables** and add:

- **Name:** `JSON2VIDEO_API_KEY`
- **Value:** your JSON2Video API key, copied directly from the JSON2Video dashboard
- **Environment:** Preview (for testing); add Production only when you are ready to use production

Save the variable, then redeploy the preview. Do not put the key in HTML, client-side JavaScript, GitHub files, or chat messages.

## 3. Test the endpoint

Open the preview deployment URL and add `/api/videos` to its path. A GET request without a project ID is expected to return a validation error; this confirms the function is reachable but does not prove that JSON2Video credentials are valid.

Use the SwiftMedia page and select **إنتاج فيديو فعلي عبر API** to submit a render. The API returns a project ID and the page polls for completion. JSON2Video usage may incur charges according to your provider plan.

## 4. Merge and production

Once the preview is reviewed and the endpoint works, merge the pull request into `main` and configure Vercel's Production Branch as `main`. Add `JSON2VIDEO_API_KEY` to the Production environment, then deploy.

## Current limitations

- This setup does not create a Vercel account, approve GitHub access, set secrets, or deploy on the owner's behalf. Those actions require signing into the owner's Vercel account.
- The key is deliberately not stored in this repository.
- GitHub Pages remains a static-only host and cannot execute the API function.
