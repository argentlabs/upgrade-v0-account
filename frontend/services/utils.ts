import {
  Account,
  Call,
  hash,
  RawArgs,
  typedData,
  RpcProvider,
  Signer,
  encode,
  ec,
  CallData,
  Contract,
  uint256,
  num,
  BigNumberish,
  ETransactionVersion,
} from "starknet";

import dotenv from "dotenv";
dotenv.config({ override: true });

// Keyless public mainnet endpoints that serve RPC spec 0.10 and allow browser (CORS) requests.
// The page used to depend on a single provider and broke for everyone when it was discontinued,
// so requests fail over to the next endpoint when one is down.
export const rpcUrls = [
  "https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/demo",
  "https://starknet-rpc.publicnode.com",
  "https://api.cartridge.gg/x/starknet/mainnet",
];

let preferredRpcIndex = 0;

// An endpoint that accepts the connection but never answers would otherwise stall the page.
const rpcAttemptTimeoutMs = 10_000;

// The timer only covers waiting for the response headers, so a large body that is still
// downloading when starknet.js reads it is not aborted.
async function fetchWithTimeout(rpcUrl: string, init?: RequestInit): Promise<Response> {
  const abortController = new AbortController();
  const timer = setTimeout(
    () => abortController.abort(new Error(`${rpcUrl} did not answer within ${rpcAttemptTimeoutMs} ms`)),
    rpcAttemptTimeoutMs,
  );
  try {
    return await fetch(rpcUrl, { ...init, signal: abortController.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Only network failures, timeouts and non-2xx responses (rate limits, discontinued endpoints) move to
// the next endpoint. A JSON-RPC error such as a revert is returned as is, since every node would give
// the same answer.
async function fetchWithFailover(_nodeUrl: string | URL | Request, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < rpcUrls.length; attempt++) {
    const rpcIndex = (preferredRpcIndex + attempt) % rpcUrls.length;
    try {
      const response = await fetchWithTimeout(rpcUrls[rpcIndex], init);
      if (response.ok) {
        preferredRpcIndex = rpcIndex;
        return response;
      }
      lastError = new Error(`${rpcUrls[rpcIndex]} answered HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    console.warn(`RPC ${rpcUrls[rpcIndex]} failed, trying the next one`, lastError);
  }
  throw lastError;
}

export const provider = new RpcProvider({
  nodeUrl: rpcUrls[0],
  specVersion: "0.10.0",
  baseFetch: fetchWithFailover,
});

export const strkAddress = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

export const udcContractAddress = "0x02ceed65a4bd731034c01113685c831b01c15d7d432f71afb1cf1634b53a2125";

export const metaV0ContractAddress = "0x03e21ab91c0899efc48b6d6ccd09b61fd37766e9b0c3cc968a7655632fbc253c";

export async function sendStrk(contractAddress: string, amount: bigint) {
  console.log(`Sending STRK to ${contractAddress}....`);
  const deployer = new Account({
    provider,
    address: process.env.ADDRESS!,
    signer: process.env.PRIVATE_KEY!,
    cairoVersion: "1",
    transactionVersion: ETransactionVersion.V3,
  });

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
    strkContract = new Contract({
      abi: ethImplementation.abi,
      address: strkAddress,
      providerOrAccount: proxy.providerOrAccount,
    });
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
  return new Contract({ abi, address: contractAddress, providerOrAccount: provider });
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
