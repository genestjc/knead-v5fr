import { getAllRpcEndpoints } from '@/thirdweb-client';

/**
 * Retry an RPC call across multiple endpoints with exponential backoff
 */
export async function retryRpcCall<T>(
  operation: (rpcUrl: string) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  const endpoints = getAllRpcEndpoints();
  let lastError: Error | null = null;
  
  for (let endpointIndex = 0; endpointIndex < endpoints.length; endpointIndex++) {
    const rpcUrl = endpoints[endpointIndex];
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`🔄 RPC attempt ${attempt + 1}/${maxRetries} using endpoint ${endpointIndex + 1}/${endpoints.length}`);
        
        const result = await operation(rpcUrl);
        
        if (attempt > 0 || endpointIndex > 0) {
          console.log(`✅ RPC call succeeded on retry (endpoint ${endpointIndex + 1}, attempt ${attempt + 1})`);
        }
        
        return result;
        
      } catch (error: any) {
        lastError = error;
        
        const is429 = error.message?.includes('429') || error.message?.includes('Too Many Requests');
        const is503 = error.message?.includes('503') || error.message?.includes('Service Unavailable');
        
        if (is429) {
          console.warn(`⚠️ Rate limited on endpoint ${endpointIndex + 1}, attempt ${attempt + 1}`);
          
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          
          if (attempt < maxRetries - 1) {
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else if (endpointIndex < endpoints.length - 1) {
            console.log(`🔀 Switching to endpoint ${endpointIndex + 2}...`);
          }
          
        } else if (is503) {
          console.warn(`⚠️ Service unavailable on endpoint ${endpointIndex + 1}`);
          // Immediately try next endpoint
          break;
          
        } else {
          // Unknown error, throw immediately
          console.error(`❌ RPC error:`, error.message);
          throw error;
        }
      }
    }
  }
  
  // All endpoints exhausted
  console.error(`❌ All RPC endpoints failed after multiple retries`);
  throw lastError || new Error('All RPC endpoints failed');
}

/**
 * Get current RPC health status
 */
export async function checkRpcHealth(): Promise<Record<string, boolean>> {
  const endpoints = getAllRpcEndpoints();
  const health: Record<string, boolean> = {};
  
  await Promise.all(
    endpoints.map(async (endpoint, index) => {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1,
          }),
        });
        
        health[`endpoint_${index + 1}`] = response.ok;
      } catch {
        health[`endpoint_${index + 1}`] = false;
      }
    })
  );
  
  console.log('🏥 RPC Health Check:', health);
  return health;
}
