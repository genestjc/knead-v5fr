interface Window {
  ethereum?: {
    isMetaMask?: boolean
    isCoinbaseWallet?: boolean
    request: (args: { method: string; params?: any[] }) => Promise<any>
    on: (event: string, callback: (...args: any[]) => void) => void
    removeListener: (event: string, callback: (...args: any[]) => void) => void
  }
}

declare module "@walletconnect/ethereum-provider" {
  export class EthereumProvider {
    static init(config: {
      projectId: string
      chains: number[]
      showQrModal: boolean
      metadata: {
        name: string
        description: string
        url: string
        icons: string[]
      }
    }): Promise<EthereumProvider>

    enable(): Promise<void>
    request(args: { method: string; params?: any[] }): Promise<any>
  }
}
