// in package.json use "starknet": "v4.6.0" . it's the last one compatible with tx V0
import { Call, Account, RpcProvider, ec, api } from "starknet4";
import { latestAccountClassHash_V_0_2_3_1 } from ".";

export async function upgradeOldContractSnJs4(
  accountAddress: string,
  privateKey: string,
  nonce: string,
  maxFee: bigint,
): Promise<string> {
  const retroFitProvider = new RetrofitRpcProvider({ nodeUrl: "https://starknet-mainnet.public.blastapi.io" });

  const oldAccount = new Account(retroFitProvider, accountAddress, ec.getKeyPair(privateKey));
  oldAccount["provider"] = retroFitProvider; // actually needed to use the RPC
  const calls: Array<Call> = [
    // upgrade to v0.2.3.1
    {
      contractAddress: oldAccount.address,
      calldata: [latestAccountClassHash_V_0_2_3_1],
      entrypoint: "upgrade",
    },
  ];
  const executionResult = await oldAccount.execute(calls, undefined, { nonce, maxFee: maxFee });
  return executionResult.transaction_hash;
}

// Make this old starknet.js version compatible with the new tx format
class RetrofitRpcProvider extends RpcProvider {
  protected fetchEndpoint<T extends keyof api.RPC.Methods>(
    method: T,
    request?: api.RPC.Methods[T]["REQUEST"] | undefined,
  ): Promise<api.RPC.Methods[T]["RESPONSE"]> {
    if (method !== "starknet_addInvokeTransaction") {
      return super.fetchEndpoint(method, request);
    }
    const original = request!;
    const newRequest = {
      type: "INVOKE",
      max_fee: original[2],
      version: "0x0",
      signature: original[1],
      contract_address: original[0].contract_address,
      entry_point_selector: original[0].entry_point_selector,
      calldata: original[0].calldata,
    };
    return super.fetchEndpoint(method, [newRequest]);
  }
  protected errorHandler(error?: any): void {
    if (error) {
      throw new Error(JSON.stringify(error));
    }
  }
}
