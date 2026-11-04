import type { Metadata, Viewport } from "next"
import { Figtree } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

// One variable font file, served from our own site (fast on mobile data).
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" })

export const metadata: Metadata = {
  title: "Azisly BD CRM",
  description: "Leads, courses and leaderboards for the Azisly.ai BD internship.",
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={figtree.variable}>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
