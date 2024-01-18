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
} from "starknet5";

export const provider = new RpcProvider({ nodeUrl: process.env.RPC_URL as string });

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

  const deployer = new Account(provider, process.env.ADDRESS as string, process.env.PRIVATE_KEY as string, "1");

  const { transaction_hash } = await deployer.execute(
    deployer.buildUDCContractPayload({
      classHash: proxyClassHash,
      salt,
      constructorCalldata,
      unique: false,
    }),
  );

  await provider.waitForTransaction(transaction_hash);

  console.log(`Deployed account at ${contractAddress} version ${version}`);
  const accountContract = await loadContract(account.address);
  accountContract.connect(account);
  return { account, accountContract, owner };
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

  public signHash(messageHash: string) {
    const { r, s } = ec.starkCurve.sign(messageHash, this.pk);
    return [r.toString(), s.toString()];
  }
}
