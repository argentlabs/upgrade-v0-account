import { hash, Account, CallData, num, Call } from "starknet";
import { getEthBalance, sendEth, KeyPair, loadContract, provider, deployer } from ".";

export async function deployOldAccount_v0_2_2(
  proxyClassHash: string,
  oldArgentAccountClassHash: string,
  version: string,
  fundAmount: bigint,
  salt: bigint,
) {
  const owner = new KeyPair(process.env.PRIVATE_KEY);

  const constructorCalldata = CallData.compile({
    implementation: oldArgentAccountClassHash,
    selector: hash.getSelectorFromName("initialize"),
    calldata: CallData.compile({ owner: owner.publicKey, guardian: 0 }),
  });

  const contractAddress = hash.calculateContractAddressFromHash(salt, proxyClassHash, constructorCalldata, 0);
  const deployerBalance = await getEthBalance(deployer.address);
  const { transaction_hash } = await deployer.execute(
    deployer.buildUDCContractPayload({
      classHash: proxyClassHash,
      salt: num.toHex(salt),
      constructorCalldata,
      unique: false,
    }),
    undefined,
    { maxFee: deployerBalance },
  );
  console.log(`Deploying account at ${contractAddress} (version ${version})`);

  await deployer.waitForTransaction(transaction_hash);

  const account = new Account(provider, contractAddress, owner, "0");
  const accountContract = await loadContract(account.address);
  accountContract.connect(account);
  await sendEth(contractAddress, fundAmount);

  return { account, accountContract, owner };
}

export async function deployOldAccount_v0_2_0_proxy(
  proxyClassHash: string,
  oldArgentAccountImplAddress: string,
  oldArgentAccountClassHash: string,
  version: string,
  fundAmount: bigint,
  salt: bigint,
) {
  const owner = new KeyPair(process.env.PRIVATE_KEY);
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
    { maxFee: await getEthBalance(deployer.address) },
  );
  console.log(`Deploying account at ${contractAddress} (version ${version})`);
  await deployer.waitForTransaction(transactionHashDeploy);

  console.log(`Initializing account at ${contractAddress} (version ${version})`);

  const initCall: Call = {
    contractAddress: contractAddress,
    entrypoint: "initialize",
    calldata: CallData.compile({ owner: owner.publicKey, guardian: 0 }),
  };
  const { transaction_hash: transactionHashExecute } = await deployer.execute([initCall], undefined, {
    maxFee: await getEthBalance(deployer.address),
  });
  await deployer.waitForTransaction(transactionHashExecute);

  console.log(`Funding account at ${contractAddress} (version ${version})`);
  await sendEth(contractAddress, fundAmount);
}
