import { NextRequest } from "next/server";
import Stripe from "stripe";
import { createThirdwebClient, getContract, call } from "thirdweb";
import { mintTo } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "@/app/abi/kneadMembershipABI.json";

const contractAbi = [const contract = getContract({
  client,
  address: CONTRACT_ADDRESS,
  chain: base,
  abi: kneadMembershipABI,
});

  {
    inputs: [
      { internalType: "string", name: "uri", type: "string" },
      { internalType: "address", name: "initialOwner", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "adminBurn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "burn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "FREEMIUM",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "PAID",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "uri",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "account", type: "address" },
      { internalType: "uint256", name: "id", type: "uint256" },
    ],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address[]", name: "accounts", type: "address[]" },
      { internalType: "uint256[]", name: "ids", type: "uint256[]" },
    ],
    name: "balanceOfBatch",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address",
      },
      { indexed: false, internalType: "bool", name: "approved", type: "bool" },
    ],
    name: "ApprovalForAll",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address",
      },
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "ids",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "values",
        type: "uint256[]",
      },
    ],
    name: "TransferBatch",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address",
      },
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      { indexed: false, internalType: "uint256", name: "id", type: "uint256" },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "TransferSingle",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "string", name: "value", type: "string" },
      { indexed: true, internalType: "uint256", name: "id", type: "uint256" },
    ],
    name: "URI",
    type: "event",
  },
];

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as string;
const ADMIN_SECRET = process.env.THIRDWEB_ADMIN_SECRET as string;
const PAID_TOKEN_ID = "1"; // This corresponds to PAID=1 in your smart contract

const client = createThirdwebClient({ secretKey: ADMIN_SECRET });

// Mint function (same as before)
async function mintPremiumNFT(walletAddress: string) {
  try {
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: contractAbi,
    });
    const result = await mintTo({
      contract,
      to: walletAddress,
      tokenId: BigInt(PAID_TOKEN_ID),
      quantity: 1n,
    });
    console.log(`Successfully minted NFT for wallet: ${walletAddress}`, result);
    return result;
  } catch (error) {
    console.error("Error minting premium NFT:", error);
    throw error;
  }
}

// Admin burn function (calls your custom adminBurn)
async function adminBurnPremiumNFT(walletAddress: string) {
  try {
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: contractAbi,
    });
    // Call the custom adminBurn(address,uint256,uint256) function
    const result = await call({
      contract,
      method: "function adminBurn(address from, uint256 id, uint256 amount)",
      params: [walletAddress, BigInt(PAID_TOKEN_ID), 1n],
    });
    console.log(
      `Successfully admin burned NFT for wallet: ${walletAddress}`,
      result,
    );
    return result;
  } catch (error) {
    console.error("Error admin burning premium NFT:", error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature") as string;
  const rawBody = await req.arrayBuffer();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      Buffer.from(rawBody),
      sig,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error(
      `Webhook signature verification failed: ${(err as Error).message}`,
    );
    return new Response(`Webhook Error: ${(err as Error).message}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const wallet = session.metadata?.wallet_address;
        if (wallet) {
          await mintPremiumNFT(wallet);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string,
          );
          const wallet = subscription.metadata?.wallet_address;
          if (wallet) {
            await adminBurnPremiumNFT(wallet);
            console.log(
              `Payment failed - Premium NFT burned for wallet: ${wallet}`,
            );
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const wallet = subscription.metadata?.wallet_address;
        if (wallet) {
          // Only burn if subscription period has ended
          const currentTimestamp = Math.floor(Date.now() / 1000);
          if (subscription.current_period_end < currentTimestamp) {
            await adminBurnPremiumNFT(wallet);
            console.log(
              `Subscription ended - Premium NFT burned for wallet: ${wallet}`,
            );
          } else {
            console.log(
              `Subscription canceled but access maintained until ${new Date(subscription.current_period_end * 1000)} for wallet: ${wallet}`,
            );
          }
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = invoice.subscription as string;
        const sub = await stripe.subscriptions.retrieve(subscription);
        const wallet = sub.metadata?.wallet_address;
        if (wallet) {
          await mintPremiumNFT(wallet);
        }
        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const wallet = paymentIntent.metadata?.wallet_address;
        if (paymentIntent.metadata?.subscription_type === "premium" && wallet) {
          await mintPremiumNFT(wallet);
          if (paymentIntent.customer) {
            try {
              const subscription = await stripe.subscriptions.create({
                customer: paymentIntent.customer as string,
                items: [{ price: "price_1RhFCBLFxM3QV6ciPmZnxyfL" }],
                metadata: { wallet_address: wallet },
              });
              console.log(`Created subscription: ${subscription.id}`);
            } catch (subError) {
              console.error("Failed to create subscription:", subError);
            }
          }
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const wallet = paymentIntent.metadata?.wallet_address;
        if (wallet) {
          console.log(`Payment failed for wallet: ${wallet}`);
        }
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
        break;
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
    });
  } catch (err) {
    console.error(`Error processing webhook: ${(err as Error).message}`);
    return new Response(
      JSON.stringify({
        received: true,
        error: `Error processing webhook: ${(err as Error).message}`,
      }),
      {
        status: 200,
      },
    );
  }
}
