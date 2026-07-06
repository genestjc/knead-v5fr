import { NextRequest, NextResponse } from 'next/server';
import { WALLET_AUTH_HEADERS } from '@/lib/auth/wallet-message';
import { verifyWalletRequest } from '@/lib/auth/verify-wallet-request';
import {
  clearSiweNonceCookie,
  createSiweChallenge,
  clearMemberSessionCookie,
  readMemberSession,
  setMemberSessionCookie,
  setSiweNonceCookie,
  verifyThirdwebInAppAuthToken,
  verifySiweMemberMessage,
} from '@/lib/auth/member-session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('challenge') === 'siwe') {
    const walletAddress = req.nextUrl.searchParams.get('walletAddress');
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing walletAddress' },
        { status: 400 },
      );
    }

    try {
      const challenge = createSiweChallenge(req, walletAddress);
      const res = NextResponse.json({
        success: true,
        address: challenge.address,
        message: challenge.message,
        nonce: challenge.nonce,
        expiresAt: challenge.expiresAt,
      });
      setSiweNonceCookie(res, challenge);
      return res;
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to create SIWE challenge' },
        { status: 400 },
      );
    }
  }

  const session = readMemberSession(req);
  if (!session.ok) {
    return NextResponse.json({ success: false, error: session.error }, { status: session.status ?? 401 });
  }
  return NextResponse.json({ success: true, address: session.address, provider: session.provider });
}

export async function POST(req: NextRequest) {
  try {
    let signedWalletAddress: string | undefined;
    if (req.headers.get(WALLET_AUTH_HEADERS.address)) {
      const auth = await verifyWalletRequest(req);
      if (!auth.ok || !auth.address) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status ?? 401 });
      }
      signedWalletAddress = auth.address;
    }

    const body = await req.json().catch(() => ({}));
    const walletAddress =
      typeof body.walletAddress === 'string' ? body.walletAddress.toLowerCase() : undefined;
    const thirdwebAuthToken =
      typeof body.thirdwebAuthToken === 'string' && body.thirdwebAuthToken.length > 0
        ? body.thirdwebAuthToken
        : undefined;
    const siweMessage =
      typeof body.siweMessage === 'string' && body.siweMessage.length > 0
        ? body.siweMessage
        : undefined;
    const siweSignature =
      typeof body.siweSignature === 'string' && body.siweSignature.length > 0
        ? body.siweSignature
        : undefined;

    let address: string;
    let provider: 'thirdweb' | 'wallet' | 'siwe';

    if (thirdwebAuthToken) {
      address = await verifyThirdwebInAppAuthToken(thirdwebAuthToken, walletAddress);
      provider = 'thirdweb';
    } else if (siweMessage && siweSignature) {
      address = await verifySiweMemberMessage(req, siweMessage, siweSignature, walletAddress);
      provider = 'siwe';
    } else if (signedWalletAddress) {
      if (walletAddress && walletAddress !== signedWalletAddress) {
        return NextResponse.json(
          { success: false, error: 'Wallet signature does not match requested session wallet' },
          { status: 403 },
        );
      }
      address = signedWalletAddress;
      provider = 'wallet';
    } else {
      return NextResponse.json({ success: false, error: 'Missing member authentication' }, { status: 401 });
    }

    const res = NextResponse.json({ success: true, address, provider });
    setMemberSessionCookie(res, address, provider);
    clearSiweNonceCookie(res);
    return res;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create member session' },
      { status: 401 },
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  clearMemberSessionCookie(res);
  clearSiweNonceCookie(res);
  return res;
}
