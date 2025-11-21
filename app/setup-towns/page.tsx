import { WagmiTownsSetupProvider } from './wagmi-provider';
import SetupTownsContent from './setup-towns-content';

export default function SetupTownsPage() {
  return (
    <WagmiTownsSetupProvider>
      <SetupTownsContent />
    </WagmiTownsSetupProvider>
  );
}
