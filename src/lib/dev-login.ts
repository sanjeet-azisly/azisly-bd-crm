import "server-only"

/**
 * One-click login for checking the app on your own Mac, without email.
 * Only on when running locally (`npm run dev`) AND DEV_LOGIN=on in .env.local.
 * It can never be on in the live app: Vercel always runs in production mode.
 */
export function devLoginEnabled() {
  return process.env.NODE_ENV === "development" && process.env.DEV_LOGIN === "on"
}
