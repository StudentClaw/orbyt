import { notarize } from "@electron/notarize"

export default async function notarizeMacApp(context) {
  if (process.platform !== "darwin") {
    return
  }

  const {
    APPLE_API_KEY,
    APPLE_API_KEY_ID,
    APPLE_API_ISSUER,
  } = process.env

  if (!APPLE_API_KEY || !APPLE_API_KEY_ID || !APPLE_API_ISSUER) {
    console.log("[student-claw notarize] Skipping notarization because Apple API credentials are missing.")
    return
  }

  const appPath = context.appOutDir.endsWith(".app")
    ? context.appOutDir
    : `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`

  await notarize({
    appPath,
    appleApiKey: APPLE_API_KEY,
    appleApiKeyId: APPLE_API_KEY_ID,
    appleApiIssuer: APPLE_API_ISSUER,
  })
}
