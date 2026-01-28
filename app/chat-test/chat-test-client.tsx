export default function ChatTestClient() {
    const [isMounted, setIsMounted] = useState(false);
    const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
    const [botAutoLoginAttempted, setBotAutoLoginAttempted] = useState(false);
    const wallet = useActiveWallet();
    const { isAgentConnected, isAgentConnecting, connect } = useAgentConnection();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // 🔑 Bot auto-login (runs BEFORE wallet checks)
    useEffect(() => {
        if (!isMounted || botAutoLoginAttempted) return;
        if (typeof window === 'undefined') return;
        
        const privateKey = (window as any).KEY_SHARER_PRIVATE_KEY;
        const isAutoMode = (window as any).KEY_SHARER_AUTO_MODE;
        
        if (!privateKey || !isAutoMode) return;
        
        setBotAutoLoginAttempted(true);
        console.log('🔑 KEY SHARER: Auto-login mode detected');
        
        (async () => {
            try {
                console.log('🔑 KEY SHARER: Starting auto-connection...');
                
                const { ethers } = await import('ethers-v5');
                const provider = new ethers.providers.JsonRpcProvider(
                    process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'
                );
                const botWallet = new ethers.Wallet(privateKey, provider);
                console.log('✅ Bot wallet created:', botWallet.address);
                
                console.log('🔑 KEY SHARER: Connecting to Towns Protocol...');
                await connect(botWallet, { 
                    townsConfig: TOWNS_CONFIG,
                    onTokenExpired: () => console.log('⚠️ KEY SHARER: Token expired')
                });
                console.log('✅ Connected to Towns Protocol');
                
                (window as any).KEY_SHARER_CONNECTED = true;
                
            } catch (error: any) {
                console.error('❌ KEY SHARER: Auto-login failed:', error);
                (window as any).KEY_SHARER_ERROR = error.message;
            }
        })();
        
    }, [isMounted, botAutoLoginAttempted, connect]);

    // ✅ Regular user auto-connect to Towns when wallet is ready
    useEffect(() => {
        if (!isMounted || !wallet || isAgentConnected || isAgentConnecting || autoConnectAttempted) {
            return;
        }
        
        if (typeof window !== 'undefined' && (window as any).KEY_SHARER_AUTO_MODE) {
            return;
        }
        
        setAutoConnectAttempted(true);
        
        const autoConnect = async () => {
            try {
                console.log('🔐 Auto-connecting to Towns Protocol...');
                const signer = await getEthersV5Signer(wallet, activeChain, client);
                await connect(signer, { 
                    townsConfig: TOWNS_CONFIG,
                    onTokenExpired: () => console.log('⚠️ Token expired')
                });
                console.log('✅ Auto-connected to Towns');
            } catch (e: any) {
                console.error("❌ Auto-connect failed:", e);
                setAutoConnectAttempted(false);
            }
        };
        
        autoConnect();
    }, [isMounted, wallet, isAgentConnected, isAgentConnecting, autoConnectAttempted, connect]);

    const handleConnectToTowns = async () => {
        if (!wallet) return;
        
        try {
            console.log('🔐 Connecting to Towns Protocol...');
            const signer = await getEthersV5Signer(wallet, activeChain, client);
            await connect(signer, { 
                townsConfig: TOWNS_CONFIG,
                onTokenExpired: () => console.log('⚠️ Token expired')
            });
            console.log('✅ Connected to Towns');
        } catch (e: any) {
            console.error("Failed to connect:", e);
            alert(`Failed to connect: ${e.message}`);
        }
    };

    // 🔑 Show key sharer UI if in auto mode
    if (typeof window !== 'undefined' && (window as any).KEY_SHARER_AUTO_MODE) {
        if (!isAgentConnected) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-white">
                    <div className="text-center max-w-md">
                        <div className="text-6xl mb-4">🔄</div>
                        <h1 className="font-adonis text-4xl mb-4">Key Sharer Connecting...</h1>
                        <LoadingSpinner />
                    </div>
                </div>
            );
        }
        
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">🟢</div>
                    <h1 className="font-adonis text-4xl mb-4">Key Sharer Online</h1>
                    <p className="font-georgia-pro text-gray-600">
                        Sharing encryption keys with new members...
                    </p>
                    <p className="font-georgia-pro text-sm text-gray-400 mt-4">
                        Connected: {new Date().toLocaleTimeString()}
                    </p>
                </div>
            </div>
        );
    }

    if (!isMounted || isAgentConnecting) {
        return <LoadingSpinner />;
    }
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            {!wallet ? (
                <div className="text-center max-w-md">
                    <h1 className="font-adonis text-4xl mb-4">Connect Your Wallet</h1>
                    <ConnectButton client={client} chain={activeChain} wallets={wallets} />
                </div>
            ) : !isAgentConnected ? (
                <div className="text-center max-w-md space-y-6">
                    <h1 className="font-adonis text-4xl mb-4">Connecting to Towns...</h1>
                    <LoadingSpinner />
                    <p className="font-georgia-pro text-sm text-gray-500">
                        This should only take a moment
                    </p>
                    <Button 
                        onClick={handleConnectToTowns} 
                        disabled={isAgentConnecting}
                        className="px-8 py-4 bg-black text-white rounded-full font-georgia-pro text-lg hover:bg-gray-800 transition"
                    >
                        Retry Connection
                    </Button>
                </div>
            ) : (
                <TownsConnectedContent />
            )}
        </div>
    );
}
