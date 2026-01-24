'use client';

import nextDynamic from 'next/dynamic';
import React, { useState, useEffect } from 'react';
import { useAgentConnection, useCreateSpace, useJoinSpace, useSpace } from '@towns-protocol/react-sdk';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { townsEnv } from '@towns-protocol/sdk';
import { Button } from '@/components/ui/button';
import { createWallet, inAppWallet } from 'thirdweb/wallets';
import { thirdwebWalletToEthersV5Signer } from '@/lib/thirdweb-to-ethers5'; // 🆕 New import

const SAVED_SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
const SAVED_CHANNEL_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID;

const TOWNS_CONFIG = townsEnv().makeTownsConfig('omega');
const NETWORK_NAME = 'Base Mainnet';

// ... rest stays the same until handleJoinSpace ...

const handleJoinSpace = async (spaceIdToJoin: string) => {
    if (!wallet || isJoiningSpace) return;
    setIsJoiningSpace(true);
    
    try {
        const userAddress = wallet.getAccount()?.address;
        if (!userAddress) throw new Error('No wallet address');

        console.log('🚪 Joining space:', spaceIdToJoin);
        console.log('👤 User address:', userAddress);

        // Step 1: Server mints membership NFT (server pays gas)
        console.log('🎫 Requesting membership NFT from server...');
        const mintResponse = await fetch('/api/towns/mint-membership', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userAddress, 
                spaceId: spaceIdToJoin 
            }),
        });

        if (!mintResponse.ok) {
            const errorData = await mintResponse.json();
            throw new Error(errorData.error || 'Failed to mint NFT');
        }
        
        const mintData = await mintResponse.json();
        if (mintData.alreadyMinted) {
            console.log('✅ Already has membership NFT');
        } else {
            console.log('✅ Membership NFT minted:', mintData.transactionHash);
            console.log('🔗 View on Basescan:', mintData.explorerUrl);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Step 2: Fund user's wallet with gas
        console.log('💰 Funding wallet with gas...');
        const fundResponse = await fetch('/api/towns/fund-wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userAddress }),
        });

        if (!fundResponse.ok) {
            const errorData = await fundResponse.json();
            throw new Error(errorData.error || 'Failed to fund wallet');
        }
        
        const fundData = await fundResponse.json();
        if (fundData.alreadyFunded) {
            console.log('✅ Wallet already has gas');
        } else {
            console.log('✅ Wallet funded:', fundData.transactionHash);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Step 3: Convert to ethers v5 signer (Towns SDK compatible)
        console.log('🔐 Converting wallet to ethers v5 signer...');
        
        const ethersSigner = await thirdwebWalletToEthersV5Signer(
            wallet,
            client,
            activeChain
        );
        
        console.log('✅ Got ethers v5 signer');
        
        // Verify signer works
        const signerAddress = await ethersSigner.getAddress();
        console.log('✅ Signer address:', signerAddress);
        console.log('✅ Signer type:', ethersSigner.constructor.name);
        
        if (signerAddress.toLowerCase() !== userAddress.toLowerCase()) {
            throw new Error(`Address mismatch: ${signerAddress} !== ${userAddress}`);
        }

        // Step 4: Join space with skipMintMembership
        console.log('🏃 Calling joinSpace...');
        await joinSpace(spaceIdToJoin, ethersSigner, { 
            skipMintMembership: true 
        });
        
        console.log('✅ Joined space successfully');
        setSpaceId(spaceIdToJoin);
        setHasJoined(true);
        
    } catch (error: any) {
        console.error('❌ Failed to join space:', error);
        
        if (error.message?.includes('already a member')) {
            console.log('ℹ️ Already a member, continuing...');
            setSpaceId(spaceIdToJoin);
            setHasJoined(true);
        } else {
            alert(`Failed to join space: ${error.message}`);
            setJoinAttempted(false);
        }
    } finally {
        setIsJoiningSpace(false);
    }
};

// Update handleCreateSpace similarly:
const handleCreateSpace = async () => {
    if (!wallet) return;
    setIsCreatingSpace(true);
    
    try {
        console.log(`🚀 Creating space on ${NETWORK_NAME}...`);
        
        const signer = await thirdwebWalletToEthersV5Signer(
            wallet,
            client,
            activeChain
        );
        
        const result = await createSpace(
            { spaceName: 'Knead Chat Space' }, 
            signer
        );

        console.log('✅ Space created successfully:', result);
        // ... rest of the function
        
    } catch (error: any) {
        console.error('❌ Failed to create space:', error);
        alert(`Failed to create space: ${error.message}`);
    } finally {
        setIsCreatingSpace(false);
    }
};

// Update handleConnectToTowns similarly:
const handleConnectToTowns = async () => {
    if (!wallet) return;
    try {
      console.log(`🔐 Connecting to Towns Protocol (omega)...`);
      
      const signer = await thirdwebWalletToEthersV5Signer(
          wallet,
          client,
          activeChain
      );
      
      await connect(signer, { townsConfig: TOWNS_CONFIG });
      
      console.log('✅ Connected to Towns Protocol');
    } catch (e: any) {
      console.error("Failed to connect to Towns:", e);
      alert(`Failed to connect to Towns: ${e.message}`);
    }
};
