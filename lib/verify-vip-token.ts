import jwt from "jsonwebtoken"

export function verifyVipToken(token: string): boolean {
  try {
    const jwtSecret = process.env.JWT_SECRET
    
    if (!jwtSecret) {
      console.error("JWT_SECRET environment variable is not set")
      throw new Error("Server configuration error: Missing JWT_SECRET")
    }
    
    const decoded = jwt.verify(token, jwtSecret) as any
    return decoded.vipAccess === true
  } catch (error) {
    console.error("VIP token verification failed:", error)
    return false
  }
}
