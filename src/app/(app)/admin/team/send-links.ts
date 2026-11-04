"use client"

import { sendLoginLink } from "@/lib/supabase/login-link"
import { markLinksSent } from "./actions"

export type SendLinksOutcome = { sent: string[]; failed: { email: string; reason: string }[]; stoppedByLimit: boolean }

/**
 * Emails login links one by one from the admin's browser and records who got one.
 * Stops early if Supabase's email limit is hit, so the rest can be sent later.
 */
export async function sendLinksTo(emails: string[], onProgress?: (done: number, total: number) => void): Promise<SendLinksOutcome> {
  const outcome: SendLinksOutcome = { sent: [], failed: [], stoppedByLimit: false }
  for (let i = 0; i < emails.length; i++) {
    const { result, message } = await sendLoginLink(emails[i])
    if (result === "sent") outcome.sent.push(emails[i])
    else if (result === "rate_limited") {
      outcome.stoppedByLimit = true
      break
    } else outcome.failed.push({ email: emails[i], reason: message ?? result })
    onProgress?.(i + 1, emails.length)
  }
  if (outcome.sent.length) await markLinksSent(outcome.sent)
  return outcome
}

export function describeOutcome(o: SendLinksOutcome, total: number) {
  if (o.stoppedByLimit) {
    return `Sent ${o.sent.length} of ${total} login links, then hit the email limit. Send the rest later with “Send login links”.`
  }
  if (o.failed.length) return `Sent ${o.sent.length} of ${total}. ${o.failed.length} failed: ${o.failed.map((f) => f.email).join(", ")}`
  return total === 1 ? "Login link sent" : `Sent ${o.sent.length} login links`
}
