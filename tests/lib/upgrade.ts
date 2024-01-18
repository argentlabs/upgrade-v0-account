// // in package.json use "starknet": "v4.6.0" . it's the last one compatible with tx V0
// import { Call, Account, RpcProvider, ec } from "starknet";
// import dotenv from "dotenv";
// import { RPC } from "starknet/dist/types/api";
// dotenv.config({ override: true });

// const address = process.env.ADDRESS;
// const privateKey = process.env.PRIVATE_KEY;
// const rpc_url: string = process.env.RPC_URL!;

// // Make this old starknet.js version compatible with the new tx format
// export class RetrofitRpcProvider extends RpcProvider {
//   protected fetchEndpoint<T extends keyof RPC.Methods>(method: T, request?: RPC.Methods[T]["REQUEST"] | undefined): Promise<RPC.Methods[T]["RESPONSE"]> {
//     if (method !== "starknet_addInvokeTransaction") {
//       return super.fetchEndpoint(method, request);
//     }
//     const original = request!
//     const newRequest = {
//       type: "INVOKE",
//       max_fee: original[2],
//       version: "0x0",
//       signature: original[1],
//       contract_address: original[0].contract_address,
//       entry_point_selector: original[0].entry_point_selector,
//       calldata: original[0].calldata,
//     }
//     return super.fetchEndpoint(method, [newRequest]);
//   }
// }

// const provider = new RetrofitRpcProvider({ nodeUrl: rpc_url });
// const deployer = new Account(provider, address!, ec.getKeyPair(privateKey));
// deployer["provider"] = provider; // actually needed to use the RPC

// const calls: Array<Call> = [
//   // upgrade to v0.2.3.1
//   {
//     contractAddress: deployer.address,
//     calldata: ["0x033434ad846cdd5f23eb73ff09fe6fddd568284a0fb7d1be20ee482f044dabe2"],
//     entrypoint: "upgrade",
//   },
// ];

// const nonce = await deployer.getNonce();
// const executionResult = await deployer.execute(calls, undefined, { nonce, maxFee: 10000000000000000n },);
// console.log(`transaction_hash: ${executionResult.transaction_hash}`);
