import type { NextApiRequest, NextApiResponse } from "next";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { ethers } from "ethers";

const CONTRACT_ADDRESS =
  "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85";
const FREEMIUM_TOKEN_ID = 0;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  const { user_address } = req.body;
  if (!user_address)
    return res
      .status(400)
      .json({ error: "Missing user_address" });

  try {
    const privateKey = process.env.THIRDWEB_PRIVATE_KEY!;
    const provider = new ethers.Wallet(
      privateKey,
      new ethers.providers.JsonRpcProvider(
        process.env.BASE_RPC_URL,
      ),
    );
    const sdk = new ThirdwebSDK(provider);
    const contract = await sdk.getContract(
      CONTRACT_ADDRESS,
    );

    // Call custom mint function (admin-only)
    await contract.call("mint", [
      user_address,
      FREEMIUM_TOKEN_ID,
      1,
    ]);

    res.status(200).json({ success: true });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}
