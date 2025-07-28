import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

// Simple in-memory rate limiting (for production, use Redis/Upstash)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function getRateLimitKey(request: NextRequest): string {
  // Use IP address for rate limiting
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0] : request.ip || "unknown"
  return `vip-access:${ip}`
}

function checkRateLimit(key: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now()
  const windowMs = 15 * 60 * 1000 // 15 minutes
  const maxAttempts = 5

  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    // First attempt or window expired
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true }
  }

  if (record.count >= maxAttempts) {
    return { allowed: false, resetTime: record.resetTime }
  }

  // Increment count
  record.count++
  rateLimitMap.set(key, record)
  return { allowed: true }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const rateLimitKey = getRateLimitKey(request)
    const rateLimit = checkRateLimit(rateLimitKey)

    if (!rateLimit.allowed) {
      const resetTime = rateLimit.resetTime ? new Date(rateLimit.resetTime).toISOString() : "unknown"
      return NextResponse.json(
        {
          error: "Too many attempts. Please try again later.",
          resetTime,
        },
        { status: 429 },
      )
    }

    const { password } = await request.json()

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 })
    }

    // Get hashed password from environment
    const hashedPassword = process.env.VIP_PASSWORD_HASH
    if (!hashedPassword) {
      console.error("VIP_PASSWORD_HASH environment variable not set")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Verify password
    const isValid = await bcrypt.compare(password, hashedPassword)

    if (!isValid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 })
    }

    // Generate JWT token for authenticated access
    const jwtSecret = process.env.JWT_SECRET || "fallback-secret-change-in-production"
    const token = jwt.sign({ vipAccess: true, timestamp: Date.now() }, jwtSecret, { expiresIn: "1h" })

    return NextResponse.json({
      success: true,
      token,
      message: "Access granted",
    })
  } catch (error) {
    console.error("VIP access verification error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
