// in package.json use "starknet": "v4.6.0" . it's the last one compatible with tx V0
import { Call, Account, RpcProvider, ec, api } from "starknet4";
import { latestAccountClassHash_V_0_2_3_1 } from ".";

export async function upgradeOldContractSnJs4(
  accountAddress: string,
  privateKey: string,
  nonce: string,
  maxFee: bigint,
): Promise<string> {
  const retroFitProvider = new RetrofitRpcProvider({ nodeUrl: process.env.RPC_URL as string });

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
  const estimatedFee = await oldAccount.estimateFee(calls, { nonce });
  throw new Error("estimateFee is not implemented in starknet4");
  // const executionResult = await oldAccount.execute(calls, undefined, { nonce, maxFee: maxFee });
  // return executionResult.transaction_hash;
}

// Make this old starknet.js version compatible with the new tx format
class RetrofitRpcProvider extends RpcProvider {
  protected fetchEndpoint<T extends keyof api.RPC.Methods>(
    method: T,
    request?: api.RPC.Methods[T]["REQUEST"] | undefined,
  ): Promise<api.RPC.Methods[T]["RESPONSE"]> {
    if (method === "starknet_estimateFee") {
      const original = request!;
      // [
      //   {
      //     contract_address: "0x5006e5598538c84f0f032d93e786a08c545d6fe624c3c27f0c1350b9dec2584",
      //     entry_point_selector: "0x15d40a3d6ca2ac30f4031e42be28da9b056fef9bb7357ac5e85627ee876e5ad",
      //     calldata: [
      //       "0x1",
      //       "0x5006e5598538c84f0f032d93e786a08c545d6fe624c3c27f0c1350b9dec2584",
      //       "0xf2f7c15cbe06c8d94597cd91fd7f3369eae842359235712def5584f8d270cd",
      //       "0x0",
      //       "0x1",
      //       "0x1",
      //       "0x33434ad846cdd5f23eb73ff09fe6fddd568284a0fb7d1be20ee482f044dabe2",
      //       "0x0",
      //     ],
      //     signature: [
      //       "0x1ee293bb1ad698602c06a96f8a2df7b2a0d1e2cf8ece78fdc2f6d8d46f995de",
      //       "0x5024c510ed48886005f0e9d9084451de17493a34fcca855e30de9026caaba6b",
      //     ],
      //     version: "0x100000000000000000000000000000000",
      //   },
      //   "pending",
      // ]

      const newRequest = {
        request : [{
          type: "INVOKE",
          max_fee: "0x0",
          version: original[0].version,
          signature: original[0].signature,
          contract_address: original[0].contract_address,
          entry_point_selector: original[0].entry_point_selector,
          calldata: original[0].calldata,
        }],
        // simulation_flags : ["SKIP_VALIDATE"],
        block_id: "latest"
      };
      
      return super.fetchEndpoint(method, newRequest as any);
    } else if (method === "starknet_addInvokeTransaction") {
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
    } else {
      return super.fetchEndpoint(method, request);
    }

  }
  protected errorHandler(error?: any): void {
    if (error) {
      throw new Error(JSON.stringify(error));
    }
  }
}
