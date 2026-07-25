# Nexa AI Mobile

A polished ChatGPT-style mobile chat app built with Expo React Native and a
secure Node.js backend and a responsive web app. It uses Groq for chat and code writing, with optional
OpenAI image generation. It runs on Android and iOS, keeps conversations on the
device, and supports light/dark mode, Markdown answers, copy, regenerate, stop,
rename, and delete.

This is an independent app and is not affiliated with or endorsed by OpenAI.

## Project structure

```text
Nexa-AI-Mobile/
├── mobile/   Expo React Native app
├── public/   Responsive Nexa AI website
├── server/   Express API that safely holds Groq/OpenAI API keys
└── src/      Vercel Express entry point
```

## 1. Requirements

- Node.js 20 or newer
- VS Code
- Android phone with Expo Go, or Android Studio emulator
- A Groq API key for chat and code writing
- Optional: an OpenAI API key with API billing for image generation

## 2. Open in VS Code

Extract the ZIP, then open the `Nexa-AI-Mobile` folder in VS Code.
Open **Terminal > New Terminal** and run:

```bash
npm install
```

On Windows, you can instead double-click `1-INSTALL.bat`, add your key to
`server/.env`, then double-click `2-START.bat`.

## 3. Configure the backend

Inside the `server` folder, copy `.env.example` and rename the copy to `.env`.
Add a **new** Groq key:

```env
CHAT_PROVIDER=groq
GROQ_API_KEY=your_new_private_groq_key
GROQ_MODEL=openai/gpt-oss-120b

# Optional: leave blank if you do not need image generation
OPENAI_IMAGE_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-2
PORT=3000
```

Never reuse the Groq key previously pasted into chat. Revoke it, create a new
key, and place the new key only in `server/.env`. Never paste keys into the
mobile app or upload `.env` to GitHub.

Start the backend in terminal 1:

```bash
npm run server
```

You should see:

```text
Nexa AI server running on http://localhost:3000
```

## 4. Start the mobile app

Open terminal 2:

```bash
npm run mobile
```

Scan the QR code in Expo Go.

### Connect a real Android phone

The phone and computer must be on the same Wi-Fi.

1. On Windows, run `ipconfig`.
2. Find the computer's **IPv4 Address**, for example `192.168.1.5`.
3. In the app, open **Settings**.
4. Enter `http://192.168.1.4:3000` as the server URL.
5. Tap **Save settings**, then test the connection.

Windows Firewall may ask for Node.js network access. Allow it on private
networks.

For the hosted version, enter the HTTPS Vercel URL instead. An APK built with
`EXPO_PUBLIC_API_URL=https://your-project.vercel.app` uses the hosted API by
default and migrates the old local Android URLs automatically.

`10.0.2.2` works only in the Android emulator. On a real phone, use the
computer's IPv4 address. Nexa AI now stops an unreachable request instead of
remaining on “Thinking” indefinitely and shows a connection message that
points back to the server URL.

### Android emulator

Use this server URL:

```text
http://10.0.2.2:3000
```

### iOS simulator

Use:

```text
http://localhost:3000
```

## 5. Build an Android APK

Log in to Expo Application Services, configure the project, then build from
the Expo app directory:

```bash
cd mobile
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

The preview profile creates an installable APK. Production builds create an
Android App Bundle for Play Store submission.

On Windows, you can double-click `3-BUILD-APK.bat` and sign in when Expo asks.
The batch file changes to `mobile` automatically. Do not run EAS from the
repository root because the CLI will miss the Expo SDK configuration.

For a free GitHub build, push this complete folder to a GitHub repository, open
the **Actions** tab, select **Build Nexa AI APK**, and choose **Run workflow**.
After it completes, download the `Nexa-AI-v1.0.4-APK` artifact.

## Nexa AI v1.0.3 fixes

- Real Android phones default to `http://192.168.1.4:3000` instead of the
  emulator-only `10.0.2.2` address.
- Existing installs using `10.0.2.2` migrate automatically.
- Chat and image requests stop with a useful connection message instead of
  remaining on “Thinking” indefinitely.
- “Designed by Hussain” uses the private `EXPO_PUBLIC_WHATSAPP_URL`
  build variable.
- EAS Build now runs from the correct Expo app directory.
- The APK build script installs dependencies before EAS validates plugins, so
  `expo-font` resolves correctly in a newly extracted project.

## Nexa AI v1.0.4 web and hosting update

- Added a responsive web app with local chat history, dark/light themes,
  suggestion cards, Markdown/code display, copy actions and mobile navigation.
- Added a Vercel-compatible Express entry point and production static hosting.
- Added support for `EXPO_PUBLIC_API_URL` so the APK can use the hosted HTTPS
  backend instead of a computer's local Wi-Fi address.
- Updated the default Groq model to `openai/gpt-oss-120b` because
  `llama-3.3-70b-versatile` reached its shutdown date.
- The creator contact is configured through environment variables instead of
  being stored in the public repository.

## Deploy with GitHub and Vercel

1. Push the repository to GitHub. Keep every `.env` file out of GitHub.
2. In Vercel, import the GitHub repository and keep the project root as the
   repository root.
3. Add these environment variables for Production, Preview and Development:

```env
CHAT_PROVIDER=groq
GROQ_API_KEY=your_new_private_groq_key
GROQ_MODEL=openai/gpt-oss-120b
RATE_LIMIT_MAX=60
APP_ORIGIN=*
CONTACT_WHATSAPP_URL=https://wa.me/your-number
```

4. Deploy and open `/health`. `configured` should be `true`.
5. In the installed Android app, open Settings and save the Vercel HTTPS URL.
   Rebuild the APK with the same URL as `EXPO_PUBLIC_API_URL` to make it the
   automatic default.

The Groq key belongs only in Vercel Environment Variables or a local
`server/.env`. Never place it in GitHub, `public/app.js`, Expo settings or the
APK.

## Important security note

The included backend protects the secret key from being extracted from the
mobile APK. Before public release, deploy the backend over HTTPS and add user
authentication, database-backed usage limits, monitoring, and abuse controls.

Groq powers normal chat, Roman Urdu answers, explanations, and code writing.
Groq does not power the image endpoint in this project. Image generation stays
disabled unless `OPENAI_IMAGE_API_KEY` is configured. GPT Image access can
require organization verification and has its own API usage cost.

## Roman Urdu quick setup

1. ZIP extract karke folder VS Code mein open karein.
2. Terminal mein `npm install` chalayein.
3. `server/.env.example` ki copy bana kar naam `.env` rakhein.
4. `.env` mein apni **new Groq key** `GROQ_API_KEY=` ke samne paste karein.
5. Image generation chahiye to optional OpenAI key
   `OPENAI_IMAGE_API_KEY=` ke samne paste karein.
6. Pehle terminal mein `npm run server` chalayein.
7. Doosre terminal mein `npm run mobile` chalayein.
8. Phone mein Expo Go se QR scan karein.
9. App Settings mein PC ka IPv4 address `http://IP:3000` form mein save karein.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run server` | Start the secure API backend |
| `npm run mobile` | Start Expo development server |
| `npm run android` | Open on Android |
| `npm run check` | Type-check mobile and server |
| `npm run build:server` | Compile the backend |
