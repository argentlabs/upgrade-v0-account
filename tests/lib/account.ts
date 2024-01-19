import {
  hash,
  Account,
  RpcProvider,
  Signer,
  encode,
  ec,
  CallData,
  Contract,
  Abi,
  ProviderInterface,
  AccountInterface,
  uint256,
} from "starknet5";

export const provider = new RpcProvider({ nodeUrl: process.env.RPC_URL as string });
export const deployer = new Account(provider, process.env.ADDRESS!, process.env.PRIVATE_KEY!, "1");
export const ethAddress = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

export async function deployOldAccount(oldArgentAccountClassHash: string, proxyClassHash: string, version?: string) {
  const owner = new KeyPair(process.env.PRIVATE_KEY);
  const guardian = new KeyPair("1");

  const constructorCalldata = CallData.compile({
    implementation: oldArgentAccountClassHash,
    selector: hash.getSelectorFromName("initialize"),
    calldata: CallData.compile({ owner: owner.publicKey, guardian: guardian.publicKey }),
  });

  const salt = "2";
  const contractAddress = hash.calculateContractAddressFromHash(salt, proxyClassHash, constructorCalldata, 0);

  const account = new Account(provider, contractAddress, owner, "0");

  const { transaction_hash } = await deployer.execute(
    deployer.buildUDCContractPayload({
      classHash: proxyClassHash,
      salt,
      constructorCalldata,
      unique: false,
    }),
  );

  await provider.waitForTransaction(transaction_hash);

  await sendEth(contractAddress);

  console.log(`Deployed account at ${contractAddress} version ${version}`);
  const accountContract = await loadContract(account.address);
  accountContract.connect(account);
  return { account, accountContract, owner };
}

export async function sendEth(contractAddress: string) {
  console.log(`Sending eth to ${contractAddress}....`);
  const { transaction_hash } = await deployer.execute({
    contractAddress: ethAddress,
    entrypoint: "transfer",
    calldata: CallData.compile({ recipient: contractAddress, amount: uint256.bnToUint256(1000000000000000n) }),
  });
  await provider.waitForTransaction(transaction_hash);
  console.log(`ETH transfer successful ${contractAddress}`);
}

export async function getEthBalance(contractAddress: string): Promise<bigint> {
  const ethContract = await loadContract(ethAddress);
  const balance = await ethContract.balanceOf(contractAddress);
  return balance;
}

class ContractWithClassHash extends Contract {
  constructor(
    abi: Abi,
    address: string,
    providerOrAccount: ProviderInterface | AccountInterface,
    public readonly classHash: string,
  ) {
    super(abi, address, providerOrAccount);
  }
}

async function loadContract(contractAddress: string, classHash?: string): Promise<ContractWithClassHash> {
  const { abi } = await provider.getClassAt(contractAddress);
  if (!abi) {
    throw new Error("Error while getting ABI");
  }

  return new ContractWithClassHash(
    abi,
    contractAddress,
    provider,
    classHash ?? (await provider.getClassHashAt(contractAddress)),
  );
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
