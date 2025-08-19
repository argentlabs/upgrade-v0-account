import { hash, Account, CallData, num, Call, RpcProvider, transaction } from "starknet";
import { KeyPair, loadContract } from ".";

const udcContractAddress = "0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf";

const provider = new RpcProvider({ nodeUrl: process.env.PROVIDER_URL! });

export async function deployOldAccount_v0_2_2(proxyClassHash: string, oldArgentAccountClassHash: string, salt: bigint) {
  console.log("provider version: ", await provider.getSpecVersion());
  const owner = new KeyPair(process.env.PRIVATE_KEY!);
  const deployer = new Account(provider, process.env.ADDRESS!, process.env.PRIVATE_KEY!, "1", "0x3");

  const constructorCalldata = CallData.compile({
    implementation: oldArgentAccountClassHash,
    selector: hash.getSelectorFromName("initialize"),
    calldata: CallData.compile({ owner: owner.publicKey, guardian: 0 }),
  });

  const { calls, addresses } = transaction.buildUDCCall(
    {
      classHash: proxyClassHash,
      salt: num.toHex(salt),
      constructorCalldata,
      unique: false,
    },
    udcContractAddress,
  );
  const contractAddress = addresses[0];

  console.log(`Deploying account at ${contractAddress}`);
  const { transaction_hash } = await deployer.execute(calls);

  await deployer.waitForTransaction(transaction_hash);

  const account = new Account(provider, contractAddress, owner, "0");
  const accountContract = await loadContract(account.address);
  accountContract.connect(account);

  return { account, accountContract, owner };
}

export async function deployOldAccount_v0_2_3(proxyClassHash: string, oldArgentAccountClassHash: string, salt: bigint) {
  console.log("provider version: ", await provider.getSpecVersion());
  const owner = new KeyPair(process.env.PRIVATE_KEY!);
  const deployer = new Account(provider, process.env.ADDRESS!, process.env.PRIVATE_KEY!, "1", "0x3");

  const constructorCalldata = CallData.compile({
    implementation: oldArgentAccountClassHash,
    selector: hash.getSelectorFromName("initialize"),
    calldata: CallData.compile({ owner: owner.publicKey, guardian: 0 }),
  });

  const { calls, addresses } = transaction.buildUDCCall(
    {
      classHash: proxyClassHash,
      salt: num.toHex(salt),
      constructorCalldata,
      unique: false,
    },
    udcContractAddress,
  );
  const contractAddress = addresses[0];

  console.log(`Deploying account at ${contractAddress}`);
  const { transaction_hash } = await deployer.execute(calls);

  await deployer.waitForTransaction(transaction_hash);

  const account = new Account(provider, contractAddress, owner, "0");
  const accountContract = await loadContract(account.address);
  accountContract.connect(account);

  return { account, accountContract, owner };
}

export async function deployOldAccount_v0_2_0_proxy(
  proxyClassHash: string,
  oldArgentAccountImplAddress: string,
  oldArgentAccountClassHash: string,
  salt: bigint,
) {
  const owner = new KeyPair(process.env.PRIVATE_KEY!);
  const deployer = new Account(provider, process.env.ADDRESS!, process.env.PRIVATE_KEY!);
  const retrievedClassHash = await provider.getClassHashAt(oldArgentAccountImplAddress);
  if (retrievedClassHash !== oldArgentAccountClassHash) {
    throw new Error("Implementation doesn't match");
  }
  const constructorCalldata = CallData.compile({ implementation: oldArgentAccountImplAddress });

  const contractAddress = hash.calculateContractAddressFromHash(salt, proxyClassHash, constructorCalldata, 0);

  const { transaction_hash: transactionHashDeploy } = await deployer.execute(
    deployer.buildUDCContractPayload({
      classHash: proxyClassHash,
      salt: num.toHex(salt),
      constructorCalldata,
      unique: false,
    }),
    undefined,
  );
  console.log(`Deploying account at ${contractAddress}`);
  await deployer.waitForTransaction(transactionHashDeploy);

  console.log(`Initializing account at ${contractAddress}`);

  const initCall: Call = {
    contractAddress: contractAddress,
    entrypoint: "initialize",
    calldata: CallData.compile({ owner: owner.publicKey, guardian: 0 }),
  };
  const { transaction_hash: transactionHashExecute } = await deployer.execute([initCall], undefined);
  await deployer.waitForTransaction(transactionHashExecute);
}
