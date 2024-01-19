// in package.json use "starknet": "v4.6.0" . it's the last one compatible with tx V0
import { Call, Account, RpcProvider, ec } from "starknet";
import { RPC } from "starknet/dist/types/api";
import { latestAccountClassHash_V_0_2_3_1, getEthBalance } from "./";

const rpc_url: string = process.env.RPC_URL!;

// Make this old starknet.js version compatible with the new tx format
export class RetrofitRpcProvider extends RpcProvider {
  protected fetchEndpoint<T extends keyof RPC.Methods>(
    method: T,
    request?: RPC.Methods[T]["REQUEST"] | undefined,
  ): Promise<RPC.Methods[T]["RESPONSE"]> {
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
}

export async function upgradeOldContract(address: string, privateKey: string) {
  const retroFitProvider = new RetrofitRpcProvider({ nodeUrl: rpc_url });
  const deployer = new Account(
    retroFitProvider,
    address,
    ec.getKeyPair(privateKey),
  );
  deployer["provider"] = retroFitProvider; // actually needed to use the RPC

  const maxFee = await getEthBalance(deployer.address);

  const calls: Array<Call> = [
    // upgrade to v0.2.3.1
    {
      contractAddress: deployer.address,
      calldata: [latestAccountClassHash_V_0_2_3_1],
      entrypoint: "upgrade",
    },
  ];

  const nonce = await deployer.getNonce();
  const executionResult = await deployer.execute(calls, undefined, { nonce, maxFee: maxFee });
  console.log(`transaction_hash: ${executionResult.transaction_hash}`);
}


