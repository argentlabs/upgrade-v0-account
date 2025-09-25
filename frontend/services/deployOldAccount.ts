import { hash, Account, CallData, num, Call, RpcProvider, transaction } from "starknet";
import { KeyPair, loadContract, provider, udcContractAddress } from ".";

async function isExistingAccount(contractAddress: string) {
  try {
    await provider.getClassHashAt(contractAddress);
    return true;
  } catch {
    return false;
  }
}

export async function deployOldAccount_v0_3(oldReadyAccountClassHash: string, salt: bigint) {
  const owner = new KeyPair(process.env.PRIVATE_KEY!);
  const deployer = new Account(provider, process.env.ADDRESS!, process.env.PRIVATE_KEY!, "1", "0x3");

  const constructorCalldata = CallData.compile({ owner: owner.publicKey, guardian: 0 });

  const { calls, addresses } = transaction.buildUDCCall(
    {
      classHash: oldReadyAccountClassHash,
      salt: num.toHex(salt),
      constructorCalldata,
      unique: false,
    },
    udcContractAddress,
  );
  const contractAddress = addresses[0];

  if (await isExistingAccount(contractAddress)) {
    console.log(`Account at ${contractAddress} already deployed`);
    const account = new Account(provider, contractAddress, owner, "0");
    const accountContract = await loadContract(account.address);
    accountContract.connect(account);
    return { account, accountContract, owner };
  }

  console.log(`Deploying account at ${contractAddress}`);
  const { transaction_hash } = await deployer.execute(calls);

  await deployer.waitForTransaction(transaction_hash);
  const account = new Account(provider, contractAddress, owner, "0");
  const accountContract = await loadContract(account.address);

  return { account, accountContract, owner };
}

export async function deployOldAccount_v0_2_2(proxyClassHash: string, oldReadyAccountClassHash: string, salt: bigint) {
  const owner = new KeyPair(process.env.PRIVATE_KEY!);
  const deployer = new Account(provider, process.env.ADDRESS!, process.env.PRIVATE_KEY!, "1", "0x3");

  const constructorCalldata = CallData.compile({
    implementation: oldReadyAccountClassHash,
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

  if (await isExistingAccount(contractAddress)) {
    console.log(`Account at ${contractAddress} already deployed`);
    const account = new Account(provider, contractAddress, owner, "0");
    const accountContract = await loadContract(account.address);
    accountContract.connect(account);
    return { account, accountContract, owner };
  }

  console.log(`Deploying account at ${contractAddress}`);
  const { transaction_hash } = await deployer.execute(calls);

  await deployer.waitForTransaction(transaction_hash);
  const account = new Account(provider, contractAddress, owner, "0");
  const accountContract = await loadContract(account.address);

  return { account, accountContract, owner };
}

export async function deployOldAccount_v0_2_0_proxy(
  proxyClassHash: string,
  oldReadyAccountImplAddress: string,
  oldReadyAccountClassHash: string,
  salt: bigint,
): Promise<string> {
  const owner = new KeyPair(process.env.PRIVATE_KEY!);
  const deployer = new Account(provider, process.env.ADDRESS!, process.env.PRIVATE_KEY!);
  const retrievedClassHash = await provider.getClassHashAt(oldReadyAccountImplAddress);
  if (retrievedClassHash !== oldReadyAccountClassHash) {
    throw new Error("Implementation doesn't match");
  }
  const constructorCalldata = CallData.compile({ implementation: oldReadyAccountImplAddress });

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
  if (await isExistingAccount(contractAddress)) {
    console.log(`Account at ${contractAddress} already deployed`);
    return contractAddress;
  }

  const initCall: Call = {
    contractAddress: contractAddress,
    entrypoint: "initialize",
    calldata: CallData.compile({ owner: owner.publicKey, guardian: 0 }),
  };

  const { transaction_hash } = await deployer.execute([...calls, initCall]);
  console.log(`Deploying account at ${contractAddress} ${transaction_hash}`);
  await deployer.waitForTransaction(transaction_hash);

  return contractAddress;
}
