import {
  Account,
  Call,
  hash,
  RawArgs,
  SignerInterface,
  typedData,
  RpcProvider,
  Signer,
  encode,
  ec,
  CallData,
  Contract,
  uint256,
  num,
  RPC,
  BigNumberish,
} from "starknet";

import dotenv from "dotenv";
dotenv.config({ override: true });

export const provider = new RpcProvider({
  nodeUrl: "https://starknet-mainnet.public.blastapi.io/rpc/v0_8",
});

export const strkAddress = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

export const udcContractAddress = "0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf";

export const meta_v0_contract_address = "0x03e21ab91c0899efc48b6d6ccd09b61fd37766e9b0c3cc968a7655632fbc253c";

export async function sendStrk(contractAddress: string, amount: bigint) {
  console.log(`Sending STRK to ${contractAddress}....`);
  const deployer = new Account(provider, process.env.ADDRESS!, process.env.PRIVATE_KEY!, "1", "0x3");

  const { transaction_hash } = await deployer.execute({
    contractAddress: strkAddress,
    entrypoint: "transfer",
    calldata: CallData.compile({ recipient: contractAddress, amount: uint256.bnToUint256(amount) }),
  });
  await provider.waitForTransaction(transaction_hash);
  console.log(`STRK transfer successful ${contractAddress}`);
}

export async function getStrkBalance(contractAddress: string): Promise<bigint> {
  const strkContract = await getStrkContract();
  return await strkContract.balanceOf(contractAddress);
}

let strkContract: Contract;

export async function getStrkContract() {
  if (strkContract) {
    return strkContract;
  }
  const proxy = await loadContract(strkAddress);
  if (proxy.abi.some((entry) => entry.name == "implementation")) {
    const implementationAddress = num.toHex((await proxy.implementation()).address);
    const ethImplementation = await loadContract(implementationAddress);
    strkContract = new Contract(ethImplementation.abi, strkAddress, proxy.providerOrAccount);
  } else {
    strkContract = proxy;
  }
  return strkContract;
}

export async function loadContract(contractAddress: string): Promise<Contract> {
  const { abi } = await provider.getClassAt(contractAddress);
  if (!abi) {
    throw new Error("Error while getting ABI");
  }
  return new Contract(abi, contractAddress, provider);
}

export class KeyPair extends Signer {
  constructor(pk?: string | bigint) {
    super(pk ? `${pk}` : `0x${encode.buf2hex(ec.starkCurve.utils.randomPrivateKey())}`);
  }

  public get privateKey() {
    return BigInt(this.pk as string);
  }

  public get publicKey() {
    return BigInt(ec.starkCurve.getStarkKey(this.pk));
  }
}

const types = {
  StarkNetDomain: [
    { name: "name", type: "felt" },
    { name: "version", type: "felt" },
    { name: "chainId", type: "felt" },
  ],
  OutsideExecution: [
    { name: "caller", type: "felt" },
    { name: "nonce", type: "felt" },
    { name: "execute_after", type: "felt" },
    { name: "execute_before", type: "felt" },
    { name: "calls_len", type: "felt" },
    { name: "calls", type: "OutsideCall*" },
  ],
  OutsideCall: [
    { name: "to", type: "felt" },
    { name: "selector", type: "felt" },
    { name: "calldata_len", type: "felt" },
    { name: "calldata", type: "felt*" },
  ],
};

function getDomain(chainId: string) {
  return {
    name: "Account.execute_from_outside",
    version: "1",
    chainId: chainId,
  };
}

export interface OutsideExecution {
  caller: string;
  nonce: BigNumberish;
  execute_after: BigNumberish;
  execute_before: BigNumberish;
  calls: OutsideCall[];
}

export interface OutsideCall {
  to: string;
  selector: BigNumberish;
  calldata: RawArgs;
}

export function getOutsideCall(call: Call): OutsideCall {
  return {
    to: call.contractAddress,
    selector: hash.getSelectorFromName(call.entrypoint),
    calldata: call.calldata ?? [],
  };
}

export function getTypedDataHash(
  outsideExecution: OutsideExecution,
  accountAddress: BigNumberish,
  chainId: string,
): string {
  return typedData.getMessageHash(getTypedData(outsideExecution, chainId), accountAddress);
}

export function getTypedData(outsideExecution: OutsideExecution, chainId: string) {
  return {
    types: types,
    primaryType: "OutsideExecution",
    domain: getDomain(chainId),
    message: {
      ...outsideExecution,
      calls_len: outsideExecution.calls.length,
      calls: outsideExecution.calls.map((call) => {
        return {
          ...call,
          calldata_len: call.calldata.length,
          calldata: call.calldata,
        };
      }),
    },
  };
}

export async function getOutsideExecutionCall(
  outsideExecution: OutsideExecution,
  accountAddress: string,
  privateKey: string,
  chainId: string,
): Promise<Call> {
  const currentTypedData = getTypedData(outsideExecution, chainId);
  const messageHash = typedData.getMessageHash(currentTypedData, accountAddress);
  const { r, s } = ec.starkCurve.sign(messageHash, privateKey);
  const signature = [r.toString(), s.toString()];

  return {
    contractAddress: accountAddress,
    entrypoint: "execute_from_outside",
    calldata: CallData.compile({ ...outsideExecution, signature }),
  };
}
