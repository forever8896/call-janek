# Honest Guide — distribution bundle

## Repo

Scan this from a phone to land on the GitHub repo:

![Honest Guide repo](repo-qr.png)

→ https://github.com/forever8896/call-janek

## Builds

| Platform | File | How to install |
|---|---|---|
| Android  | `honest-guide-android.apk` | Download to phone → tap to install. Allow "install from unknown sources" if prompted. |
| iOS      | `honest-guide-ios.ipa`     | Requires UDID-registered device + ad-hoc provisioning. See **iOS install** below. |

Both binaries are produced by `eas build --profile preview` (internal
distribution). Channel `preview` accepts OTA updates pushed via
`eas update --channel preview` — bundles auto-update on next launch.

### Android install

1. Transfer the APK to the phone (AirDrop-equivalent, USB, or download URL).
2. Tap the file → Android prompts to install.
3. First time: allow "install from unknown sources" for the file manager.

### iOS install

iOS binaries can't be sideloaded freely. Two options:

1. **TestFlight** (best for sharing with anyone): submit the production
   build with `eas submit --platform ios --profile production`, invite
   testers by email or a public link.
2. **Ad-hoc**: each tester's UDID must be registered in our Apple
   Developer account first via `eas device:create`. Then the IPA can
   be installed by tapping a hosted download link.

### Rebuild

```bash
eas build --profile preview --platform android   # APK
eas build --profile preview --platform ios       # IPA (needs certs)
eas build --profile preview --platform all       # both
```

After the build finishes, EAS prints a public URL where the artifact
is hosted for ~30 days.
