import Anthropic from '@anthropic-ai/sdk';
import { requestCard, sendUsdc } from '@/lib/agentcard';
import { getSupabaseAdmin } from '@/lib/supabase/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';
const MAX_TOOL_ROUNDS = 10;

export interface AgentCommand {
  command: string;
  senderAddress: string;
  channelId?: string;
  proposalId?: string;
}

export interface AgentResult {
  success: boolean;
  summary: string;
  actionsCompleted: string[];
  errors: string[];
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'request_virtual_card',
    description: 'Request a one-time virtual credit card from AgentCard for a given USD amount. Returns PAN, CVV, expiry, and billing ZIP. Use this before any Shopify checkout.',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount_usd: { type: 'number', description: 'Total charge amount in USD (e.g. 29.99).' },
        purpose: { type: 'string', description: 'Brief description of what this card will be used for.' },
      },
      required: ['amount_usd', 'purpose'],
    },
  },
  {
    name: 'send_usdc_payment',
    description: "Send USDC directly to a contributor's wallet address on Base L2 for labor payments. Do NOT use this for merch or magazine purchases.",
    input_schema: {
      type: 'object' as const,
      properties: {
        to_address: { type: 'string', description: "Recipient's 0x wallet address on Base." },
        amount_usdc: { type: 'number', description: 'Amount in USDC (e.g. 50.00).' },
        memo: { type: 'string', description: 'Human-readable memo describing the payment purpose.' },
      },
      required: ['to_address', 'amount_usdc', 'memo'],
    },
  },
  {
    name: 'shopify_checkout',
    description: 'Purchase a Shopify product on behalf of a member using a virtual card. Call request_virtual_card first. Use product_handle "knead-magazine" for the print magazine.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_handle: { type: 'string', description: 'Shopify product handle (slug) to purchase.' },
        quantity: { type: 'number', description: 'Number of units to order.' },
        recipient_name: { type: 'string', description: 'Full name for shipping label.' },
        shipping_address: {
          type: 'object',
          description: 'Shipping address for physical delivery.',
          properties: {
            address1: { type: 'string' },
            city: { type: 'string' },
            province: { type: 'string', description: 'State/province abbreviation' },
            zip: { type: 'string' },
            country: { type: 'string', description: 'Two-letter country code, e.g. US' },
          },
          required: ['address1', 'city', 'province', 'zip', 'country'],
        },
        card: {
          type: 'object',
          description: 'Virtual card details from request_virtual_card.',
          properties: {
            pan: { type: 'string' },
            cvv: { type: 'string' },
            expiry: { type: 'string', description: 'MM/YYYY or MM/YY' },
            billing_zip: { type: 'string' },
          },
          required: ['pan', 'cvv', 'expiry', 'billing_zip'],
        },
      },
      required: ['product_handle', 'quantity', 'recipient_name', 'shipping_address', 'card'],
    },
  },
  {
    name: 'post_towns_message',
    description: 'Post a status update or completion report to the Towns chat channel.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string', description: 'Message text to post in the channel.' },
        channel_id: { type: 'string', description: 'Towns channel ID. Omit to use the default agent channel.' },
      },
      required: ['message'],
    },
  },
  {
    name: 'lookup_member',
    description: 'Look up a Knead member by wallet address or alias to retrieve their profile and any stored shipping address.',
    input_schema: {
      type: 'object' as const,
      properties: {
        identifier: { type: 'string', description: '0x wallet address or display alias.' },
      },
      required: ['identifier'],
    },
  },
];

async function handleTool(
  name: string,
  input: Record<string, unknown>,
  context: { defaultChannelId: string; postMessage: (msg: string, channelId?: string) => Promise<void> },
): Promise<string> {
  switch (name) {
    case 'request_virtual_card': {
      const card = await requestCard(input.amount_usd as number);
      return JSON.stringify(card);
    }
    case 'send_usdc_payment': {
      const result = await sendUsdc(input.to_address as string, input.amount_usdc as number);
      if (!result.txHash) throw new Error('AgentCard returned no tx hash for USDC transfer');
      return JSON.stringify(result);
    }
    case 'shopify_checkout': {
      const result = await shopifyCheckout(input as any);
      return JSON.stringify(result);
    }
    case 'post_towns_message': {
      await context.postMessage(input.message as string, (input.channel_id as string) || context.defaultChannelId);
      return JSON.stringify({ sent: true });
    }
    case 'lookup_member': {
      const member = await lookupMember(input.identifier as string);
      return JSON.stringify(member);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function shopifyCheckout(payload: {
  product_handle: string;
  quantity: number;
  recipient_name: string;
  shipping_address: Record<string, string>;
  card: { pan: string; cvv: string; expiry: string; billing_zip: string };
}): Promise<{ order_id: string; total: string; status: string }> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  if (!domain || !token) throw new Error('Missing Shopify env vars');

  const endpoint = `https://${domain}/api/2023-10/graphql.json`;
  const headers = { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token };

  async function gql(query: string, variables?: unknown) {
    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data;
  }

  const productData = await gql(`query($handle: String!) { productByHandle(handle: $handle) { variants(first: 1) { edges { node { id price { amount } } } } } }`, { handle: payload.product_handle });
  const variant = productData?.productByHandle?.variants?.edges?.[0]?.node;
  if (!variant) throw new Error(`Product not found: ${payload.product_handle}`);

  const [firstName, ...lastParts] = payload.recipient_name.split(' ');
  const lastName = lastParts.join(' ') || '-';

  const checkoutData = await gql(`
    mutation($input: CheckoutCreateInput!) {
      checkoutCreate(input: $input) {
        checkout { id totalPriceV2 { amount currencyCode } availableShippingRates { shippingRates { handle } } }
        checkoutUserErrors { message }
      }
    }
  `, { input: { lineItems: [{ variantId: variant.id, quantity: payload.quantity }], shippingAddress: { firstName, lastName, ...payload.shipping_address } } });

  const checkout = checkoutData?.checkoutCreate?.checkout;
  const errors = checkoutData?.checkoutCreate?.checkoutUserErrors ?? [];
  if (errors.length) throw new Error(errors[0].message);
  if (!checkout) throw new Error('Checkout creation failed');

  const checkoutId = checkout.id;
  let shippingRates = checkout.availableShippingRates?.shippingRates ?? [];
  if (!shippingRates.length) {
    await new Promise(r => setTimeout(r, 2000));
    const ratesData = await gql(`query($id: ID!) { node(id: $id) { ... on Checkout { availableShippingRates { shippingRates { handle } } } } }`, { id: checkoutId });
    shippingRates = ratesData?.node?.availableShippingRates?.shippingRates ?? [];
  }
  if (shippingRates.length) {
    await gql(`mutation($checkoutId: ID!, $shippingRateHandle: String!) { checkoutShippingLineUpdate(checkoutId: $checkoutId, shippingRateHandle: $shippingRateHandle) { checkout { id } checkoutUserErrors { message } } }`, { checkoutId, shippingRateHandle: shippingRates[0].handle });
  }

  const [expMonth, expYear] = parseExpiry(payload.card.expiry);
  const vaultRes = await fetch('https://elb.deposit.shopifycs.com/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credit_card: { number: payload.card.pan, first_name: firstName, last_name: lastName, month: expMonth, year: expYear, verification_value: payload.card.cvv } }),
  });
  const vaultJson = await vaultRes.json();
  if (!vaultJson.id) throw new Error('Card vaulting failed');

  const completeData = await gql(`
    mutation($checkoutId: ID!, $payment: CreditCardPaymentInputV2!) {
      checkoutCompleteWithCreditCardV2(checkoutId: $checkoutId, payment: $payment) {
        checkout { id order { id name totalPriceV2 { amount currencyCode } } }
        checkoutUserErrors { message }
        payment { errorMessage }
      }
    }
  `, { checkoutId, payment: { paymentAmount: { amount: checkout.totalPriceV2.amount, currencyCode: checkout.totalPriceV2.currencyCode }, idempotencyKey: `knead-agent-${Date.now()}`, billingAddress: { firstName, lastName, address1: payload.shipping_address.address1, city: payload.shipping_address.city, province: payload.shipping_address.province, zip: payload.card.billing_zip, country: payload.shipping_address.country }, vaultId: vaultJson.id } });

  const completeErrors = completeData?.checkoutCompleteWithCreditCardV2?.checkoutUserErrors ?? [];
  if (completeErrors.length) throw new Error(completeErrors[0].message);
  const paymentError = completeData?.checkoutCompleteWithCreditCardV2?.payment?.errorMessage;
  if (paymentError) throw new Error(`Payment failed: ${paymentError}`);
  const order = completeData?.checkoutCompleteWithCreditCardV2?.checkout?.order;

  return { order_id: order?.id ?? checkoutId, total: `${checkout.totalPriceV2.amount} ${checkout.totalPriceV2.currencyCode}`, status: order ? 'placed' : 'processing' };
}

function parseExpiry(expiry: string): [number, number] {
  const [month, year] = expiry.split('/').map(s => parseInt(s.trim(), 10));
  return [month, year < 100 ? 2000 + year : year];
}

async function lookupMember(identifier: string) {
  const supabase = getSupabaseAdmin();
  const normalized = identifier.toLowerCase();
  const { data } = await supabase
    .from('chat_users')
    .select('id, address, alias, bio, role, membership_tier, contributor_type')
    .or(`address.eq.${normalized},alias.ilike.${identifier}`)
    .single();
  if (!data) return { found: false, identifier };
  return { found: true, address: data.address, alias: data.alias, role: data.role, membershipTier: data.membership_tier, contributorType: data.contributor_type };
}

export async function runAgent(
  command: AgentCommand,
  postMessage: (message: string, channelId?: string) => Promise<void>,
): Promise<AgentResult> {
  const defaultChannelId = command.channelId || process.env.NEXT_PUBLIC_CHANNEL_ID || '';

  const systemPrompt = `You are AgentCommune, the autonomous agent for Knead Magazine, operating inside a Towns Protocol chat on Base L2.

Your role: execute purchase and payment tasks autonomously when instructed by Admin or Contributor wallets.

Capabilities:
- Request one-time virtual cards via AgentCard for physical purchases (merch, magazine)
- Send USDC directly to contributor wallet addresses for labor payments
- Complete Shopify checkouts headlessly using virtual card details
- Post status updates back to the Towns chat

Rules:
- Always post_towns_message when you start a significant action and when you complete it
- For "send merch to [member]": look up the member, request a virtual card, complete a Shopify checkout for the appropriate product handle
- For "send magazine to [member]": use product handle "knead-magazine"
- For labor payments: use send_usdc_payment directly — never use a virtual card for wallet-to-wallet transfers
- If a shipping address is unknown, post a message asking for it and stop — do not guess
- Always include tx hashes or order IDs in completion messages
- Be concise in chat messages

The command was issued by wallet: ${command.senderAddress}
${command.proposalId ? `This is an autonomous proposal execution (proposal ID: ${command.proposalId})` : ''}`;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: command.command }];
  const actionsCompleted: string[] = [];
  const errors: string[] = [];
  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    const response = await anthropic.messages.create({ model: MODEL, max_tokens: 4096, system: systemPrompt, tools: TOOLS, messages });
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text');
      const summary = textBlock && 'text' in textBlock ? textBlock.text : 'Agent completed.';
      return { success: errors.length === 0, summary, actionsCompleted, errors };
    }

    if (response.stop_reason !== 'tool_use') break;

    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      if (block.type !== 'tool_use') continue;
      let result: string;
      let isError = false;
      try {
        result = await handleTool(block.name, block.input as Record<string, unknown>, { defaultChannelId, postMessage });
        actionsCompleted.push(`${block.name}(${JSON.stringify(block.input)})`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        result = `Error: ${msg}`;
        isError = true;
        errors.push(`${block.name}: ${msg}`);
      }
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result, is_error: isError });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { success: false, summary: 'Agent exceeded maximum tool rounds or reached unexpected stop.', actionsCompleted, errors };
}
