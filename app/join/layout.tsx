import type { Metadata } from "next"
import { SITE_NAME } from "@/lib/constants"

// app/join/page.tsx is a client component and so cannot export metadata
// itself; this layout carries it. Without it the page inherited the root
// title and description, which said nothing about membership.
export const metadata: Metadata = {
  title: "Become a member",
  description: `Membership for ${SITE_NAME}, an independent magazine covering art, music, food, technology, and other creative disciplines. Members get unlimited access to every story.`,
  alternates: { canonical: "/join" },
}

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
