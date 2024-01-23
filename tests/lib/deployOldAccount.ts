import { hash, Account, CallData, num } from "starknet";
import { getEthBalance, sendEth, KeyPair, loadContract, provider, deployer } from ".";

export async function deployOldAccount(
  oldArgentAccountClassHash: string,
  proxyClassHash: string,
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
