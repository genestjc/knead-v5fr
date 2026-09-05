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

// Canonical origin for anything a machine reads: sitemap URLs, robots, and the
// absolute URLs required by JSON-LD. Never a relative path — crawlers resolve
// these outside the context of the page that emitted them. No trailing slash.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://kneadmag.com"
).replace(/\/+$/, "");

/**
 * How Knead describes itself to a machine.
 *
 * SITE_DESCRIPTION has one job the slogan cannot do: say what kind of thing
 * Knead is. An answer engine that has only "Nourishment for the creative
 * spirit." to work with has to infer the category from whatever article it
 * happens to be reading — which is how a piece titled "Can AI Make An Artist
 * Better?" got Knead classified as image-generation software. Lead with the
 * noun. The slogan keeps its place as schema.org's `slogan`.
 *
 * Keep this wording in step with the copy on /about; entity resolution rewards
 * a description that is the same everywhere and punishes one that drifts.
 */
export const SITE_NAME = "Knead";
export const SITE_DESCRIPTION =
  "Knead is an independent magazine covering art, music, food, technology, and other creative disciplines.";
export const SITE_SLOGAN = "Nourishment for the creative spirit.";

/** Topical scope, declared rather than inferred. */
export const SITE_TOPICS = [
  "art",
  "music",
  "food",
  "technology",
  "creative culture",
  "independent journalism",
];

/**
 * Profiles an engine can use to corroborate that this organization is the same
 * one it has seen elsewhere. These only work if the bios on the other end agree
 * with SITE_DESCRIPTION — a profile that calls Knead something else is a
 * contradiction, not a corroboration.
 */
export const SITE_SOCIAL_PROFILES = [
  "https://www.instagram.com/knead.mag/",
  "https://x.com/kneadmag",
  "https://warpcast.com/knead",
];
