import { Account, ETransactionVersion, TransactionType, ec, num, selector, stark } from "starknet";
import {
  ProxyType,
  deployOldAccount_v0_2_0_proxy,
  deployOldAccount_v0_2_2,
  deployOldAccount_v0_3,
  getStrkBalance,
  provider,
  sendStrk,
  strkAddress,
  upgradeFrom_0_2_3,
  upgradeOldContract,
  upgradeV0,
  v0_2_0_implementationAddress,
  v0_2_0_implementationClassHash,
  v0_2_0_proxyClassHash,
  v0_2_1_implementationAddress,
  v0_2_1_implementationClassHash,
  v0_2_2_implementationClassHash,
  v0_2_2_proxyClassHash,
  v0_2_3_0_implementationAddress,
  v0_2_3_0_implementationClassHash,
  v0_2_3_1_implementationAddress,
  v0_2_3_1_implementationClassHash,
  v0_3_0_implementationAddress,
  v0_3_0_implementationClassHash,
  v0_3_1_implementationClassHash,
  v0_4_0_implementationClassHash,
} from "../frontend/services";

const privateKey = process.env.PRIVATE_KEY!;
const deployerAddress = process.env.ADDRESS!;
const executorAccount = new Account(provider, deployerAddress, privateKey, "1", ETransactionVersion.V3);

const salt = num.toBigInt(stark.randomAddress());

async function tryFund(address: string) {
  const balance = await getStrkBalance(address);
  console.log(`STRK balance: ${balance}`);
  if (balance === 0n) {
    await sendStrk(address, 10n ** 16n);
  }
}

async function upgrade(version: string, deployFn: () => Promise<string>) {
  console.log(`Upgrading account version ${version}...`);
  const address = await deployFn();

  await tryFund(address);

  let txHashOrMulticall;
  do {
    txHashOrMulticall = await upgradeOldContract(console, address, privateKey);
    if (txHashOrMulticall) {
      console.log(txHashOrMulticall);
      let txHash: string;
      if (typeof txHashOrMulticall === "string") {
        txHash = txHashOrMulticall;
      } else {
        const call = txHashOrMulticall;

        const calls = [
          {
            contractAddress: call.contract_address,
            entrypoint: call.entry_point,
            calldata: call.calldata,
          },
        ];

        const simulationResult = await executorAccount.simulateTransaction([
          {
            type: TransactionType.INVOKE,
            payload: calls,
          },
        ]);

        const tx = await executorAccount.execute(calls, { resourceBounds: simulationResult[0].resourceBounds });
        txHash = tx.transaction_hash;
      }
      await provider.waitForTransaction(txHash);
    }
  } while (txHashOrMulticall);

  const testAccount = new Account(provider, address, privateKey, "1", "0x3");
  const classHash = await provider.getClassHashAt(address);
  if (classHash !== v0_4_0_implementationClassHash) {
    throw new Error(`Unexpected class hash after upgrade: ${classHash}`);
  }

  try {
    const response = await testAccount.execute([]);
    console.log("Empty tx to verify account works, tx hash:", response.transaction_hash);
    await provider.waitForTransaction(response.transaction_hash);
  } catch (err) {
    // exceed balance can happen when accont was already tested
    if (err instanceof Error && !err.message.includes("exceed balance")) {
      throw err;
    }
  }
}

async function main() {
  await upgrade("v0.2.0 old proxy", async () =>
    deployOldAccount_v0_2_0_proxy(
      v0_2_0_proxyClassHash,
      v0_2_0_implementationAddress,
      v0_2_0_implementationClassHash,
      salt,
    ),
  );
  await upgrade("v0.2.1 old proxy", async () =>
    deployOldAccount_v0_2_0_proxy(
      v0_2_0_proxyClassHash,
      v0_2_1_implementationAddress,
      v0_2_1_implementationClassHash,
      salt,
    ),
  );
  await upgrade("v0.2.2 new proxy", async () => {
    const { account } = await deployOldAccount_v0_2_2(v0_2_2_proxyClassHash, v0_2_2_implementationClassHash, salt);
    return account.address;
  });
  await upgrade("v0.2.3.0 new proxy", async () => {
    const { account } = await deployOldAccount_v0_2_2(v0_2_2_proxyClassHash, v0_2_3_0_implementationClassHash, salt);
    return account.address;
  });
  await upgrade("v0.2.3.1 new proxy", async () => {
    const { account } = await deployOldAccount_v0_2_2(v0_2_2_proxyClassHash, v0_2_3_1_implementationClassHash, salt);
    return account.address;
  });
  await upgrade("v0.3.0 new proxy", async () => {
    const { account } = await deployOldAccount_v0_2_2(v0_2_2_proxyClassHash, v0_3_0_implementationClassHash, salt);
    return account.address;
  });

  await upgrade("v0.3.1 new proxy", async () => {
    const { account } = await deployOldAccount_v0_2_2(v0_2_2_proxyClassHash, v0_3_1_implementationClassHash, salt);
    return account.address;
  });
}

main().catch(console.error);
