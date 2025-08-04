// Token IDs
export const TOKEN_IDS = {
  FREEMIUM: 0,
  PREMIUM: 1,
};

// Contract addresses
export const CONTRACT_ADDRESSES = {
  KNEAD_MEMBERSHIP: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as string,
};

// Membership types
export const MEMBERSHIP_TYPES = {
  NONE: null,
  FREEMIUM: "freemium",
  PREMIUM: "premium",
};

// Subscription prices
export const SUBSCRIPTION_PRICES = {
  MONTHLY: "$5/month",
};

// Article limits
export const ARTICLE_LIMITS = {
  FREEMIUM: 3,
};
