import { Account, Contract, num } from "starknet";
import toast from "react-hot-toast";
import { getEthBalance, upgradeOldContractSnJs4, provider, loadContract, KeyPair, v0_2_2_implementation } from ".";

export async function upgradeOldContract(accountAddress: string, privateKey: string): Promise<string> {
  const keyPair = new KeyPair(privateKey);
  const accountToUpgrade = new Account(provider, accountAddress, privateKey);
  const proxyContract = await loadContract(accountAddress);
  const proxyClassHash = await accountToUpgrade.getClassHashAt(accountAddress);
  console.log("proxyClassHash", proxyClassHash);

  const implementationClassHash = num.toHexString((await proxyContract.get_implementation()).implementation);
  console.log("implementationClassHash", implementationClassHash);

  if (implementationClassHash !== v0_2_2_implementation) {
    throw new Error("Implementation doesn't match");
  }

  const { abi } = await provider.getClassByHash(implementationClassHash);
  const accountContract = new Contract(abi, accountAddress, provider);

  const currentSigner = num.toHexString((await accountContract.get_signer()).signer);
  if (num.toBigInt(currentSigner) !== keyPair.publicKey) {
    throw new Error("Signer doesn't match private key");
  }

  const currentGuardian = num.toHexString((await accountContract.get_guardian()).guardian);
  if (currentGuardian !== "0x0") {
    throw new Error("Account has a guardian, can't upgrade");
  }

  const ethBalance = await getEthBalance(accountToUpgrade.address);
  if (BigInt(ethBalance) === 0n) {
    throw new Error("Account has no funds, please transfer some ETH to it");
  }
  const MAX_ALLOWED_FEE = 3000000000000000n; // 0.003 ETH
  const maxFee = ethBalance < MAX_ALLOWED_FEE ? ethBalance : MAX_ALLOWED_FEE;
  console.log("maxFee", ethBalance, "WEI");

  const nonce = (await accountContract.get_nonce()).nonce;
  console.log("nonce", nonce);
  const upgradeTransactionHash = await upgradeOldContractSnJs4(accountAddress, privateKey, nonce, maxFee);
  await provider.waitForTransaction(upgradeTransactionHash);
  return upgradeTransactionHash;
}
