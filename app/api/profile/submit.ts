import { NextApiRequest, NextApiResponse } from "next";

// Store in DB or thirdweb storage, mark as pending approval
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  const { address, alias, bio, profilePic } = req.body;
  // Save to DB/storage, mark as pending
  // ...
  return res.status(200).json({ ok: true });
}
