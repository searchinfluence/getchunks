# Google Tag Manager Setup

This project uses environment variables to inject the Google Tag Manager ID at build time, so your GTM ID is never committed to the repository.

## How It Works

1. The HTML file contains placeholder `GTM-XXXXXXX` values
2. A build script (`scripts/build.js`) replaces these placeholders with the actual GTM ID from the `GTM_ID` environment variable
3. The build script runs automatically on Vercel deployments via the `buildCommand` in `vercel.json`

## Setting Up Your GTM ID

**Important**: This project uses `GTM_ID` (NOT `NEXT_PUBLIC_GTM_ID`). The build script runs server-side, so it doesn't need the Next.js `NEXT_PUBLIC_` prefix.

### For Vercel Deployments

1. Go to your Vercel project settings
2. Navigate to **Settings** → **Environment Variables**
3. Add a new environment variable:
   - **Name**: `GTM_ID` (no prefix needed - this is NOT a Next.js project)
   - **Value**: Your actual GTM ID (e.g., `GTM-4G43`)
   - **Environment**: Production, Preview, and Development (as needed)
4. Redeploy your project

The build script will automatically inject your GTM ID during the build process.

### For Local Development

Set the environment variable before running the build:

```bash
export GTM_ID=GTM-4G43
npm run build
```

Or run it inline:

```bash
GTM_ID=GTM-4G43 npm run build
```

## Important Notes

- **Never commit your real GTM ID** to the repository
- The placeholder `GTM-XXXXXXX` is safe to commit
- The build script will use `GTM-XXXXXXX` as a fallback if `GTM_ID` is not set
- Make sure to set the `GTM_ID` environment variable in your Vercel project settings

