"use client"

import NextLink from "next/link"
import type { ComponentProps, ReactNode } from "react"

interface LinkProps extends ComponentProps<typeof NextLink> {
  children: ReactNode
}

export function Link(props: LinkProps) {
  return <NextLink {...props} />
}
