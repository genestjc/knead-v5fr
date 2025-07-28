const CONTRACT_ADDRESS =
  "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85";
const PREMIUM_TOKEN_ID = 1;

export async function mintPremiumNFT(
  walletAddress: string,
) {
  const res = await fetch(
    `https://api.thirdweb.com/v1/contract/${CONTRACT_ADDRESS}/erc1155/mint-to`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.THIRDWEB_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: walletAddress,
        tokenId: PREMIUM_TOKEN_ID,
        amount: 1,
      }),
    },
  );
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || "Mint failed");
  }
  return await res.json();
}

export async function burnPremiumNFT(
  walletAddress: string,
) {
  const res = await fetch(
    `https://api.thirdweb.com/v1/contract/${CONTRACT_ADDRESS}/erc1155/burn`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.THIRDWEB_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: walletAddress,
        tokenId: PREMIUM_TOKEN_ID,
        amount: 1,
      }),
    },
  );
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || "Burn failed");
  }
  return await res.json();
}
