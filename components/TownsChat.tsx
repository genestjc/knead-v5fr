import {
  TownsProvider,
  Chat,
} from "@towns-protocol/react-sdk";

export function TownsChat({
  spaceId,
  userAddress,
}: {
  spaceId: string;
  userAddress: string;
}) {
  return (
    <TownsProvider
      apiKey={process.env.NEXT_PUBLIC_TOWNS_API_KEY!}
    >
      <Chat spaceId={spaceId} userAddress={userAddress} />
    </TownsProvider>
  );
}
