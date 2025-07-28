import jwt from "jsonwebtoken"

export function verifyVipToken(token: string): boolean {
  try {
    const jwtSecret = process.env.JWT_SECRET || "fallback-secret-change-in-production"
    const decoded = jwt.verify(token, jwtSecret) as any
    return decoded.vipAccess === true
  } catch (error) {
    return false
  }
}
