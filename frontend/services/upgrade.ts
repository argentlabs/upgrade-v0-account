import {
  Account,
  Contract,
  num,
  hash,
  ec,
  constants,
  shortString,
  CallData,
  selector,
  v2hash,
  stark,
  Call,
} from "starknet";
import {
  provider,
  loadContract,
  KeyPair,
  v0_2_2_implementationClassHash,
  v0_2_2_proxyClassHash,
  v0_2_0_proxyClassHash,
  v0_2_1_implementationClassHash,
  v0_2_0_implementationClassHash,
  v0_2_3_1_implementationClassHash,
  v0_2_3_0_implementationClassHash,
  getOutsideExecutionCall,
  getOutsideCall,
  v0_3_1_implementationClassHash,
  v0_4_0_implementationClassHash,
  v0_3_0_implementationClassHash,
  meta_v0_contract_address,
  v0_2_3_1_implementationAddress,
} from ".";

enum OldAccountVersion {
  v0_2_0,
  v0_2_1,
  v0_2_2,
  v0_2_3_0,
  v0_2_3_1,
  v0_3_0,
  v0_3_1,
  v0_4_0,
}

export enum ProxyType {
  OldProxy,
  NewProxy,
  NoProxy,
}

interface ILogger {
  log(...args: any[]): void;
}

export async function getAccountVersion(
  logger: ILogger,
  accountAddress: string,
): Promise<[OldAccountVersion, ProxyType, string]> {
  const accountContract = await loadContract(accountAddress);
  const accountClassHash = num.cleanHex(await provider.getClassHashAt(accountAddress));

  logger.log("account class hash", accountClassHash);

  let proxyType: ProxyType;
  let implementationClassHash: string;
  if (accountClassHash === v0_2_2_proxyClassHash) {
    implementationClassHash = num.toHexString((await accountContract.get_implementation()).implementation);
    proxyType = ProxyType.NewProxy;
  } else if (accountClassHash === v0_2_0_proxyClassHash) {
    const implementationAddress = num.toHexString((await accountContract.get_implementation()).implementation);
    logger.log("implementationAddress", implementationAddress);
    implementationClassHash = await provider.getClassHashAt(implementationAddress);
    proxyType = ProxyType.OldProxy;
  } else {
    proxyType = ProxyType.NoProxy;
    implementationClassHash = accountClassHash;
  }

  logger.log("implementationClassHash", implementationClassHash);

  implementationClassHash = num.cleanHex(implementationClassHash);

  let version: OldAccountVersion;
  switch (implementationClassHash) {
    case v0_2_0_implementationClassHash:
      version = OldAccountVersion.v0_2_0;
      break;
    case v0_2_1_implementationClassHash:
      version = OldAccountVersion.v0_2_1;
      break;
    case v0_2_2_implementationClassHash:
      version = OldAccountVersion.v0_2_2;
      break;
    case v0_2_3_0_implementationClassHash:
      version = OldAccountVersion.v0_2_3_0;
      break;
    case v0_2_3_1_implementationClassHash:
      version = OldAccountVersion.v0_2_3_1;
      break;
    case v0_3_0_implementationClassHash:
      version = OldAccountVersion.v0_3_0;
      break;
    case v0_3_1_implementationClassHash:
      version = OldAccountVersion.v0_3_1;
      break;
    case v0_4_0_implementationClassHash:
      version = OldAccountVersion.v0_4_0;
      break;
    default:
      throw new Error("Unknown implementation class hash");
  }
  return [version, proxyType, implementationClassHash];
}

export async function verifyAccountOwnerAndGuardian(
  logger: ILogger,
  accountAddress: string,
  privateKey: string,
  accountVersion: OldAccountVersion,
  implementationClassHash: string,
) {
  const keyPair = new KeyPair(privateKey);
  const { abi } = await provider.getClassByHash(implementationClassHash);
  const accountContract = new Contract(abi, accountAddress, provider);

  logger.log("keyPair.pubKey", keyPair.publicKey);

  let currentSigner: string;
  let currentGuardian: string;

  switch (accountVersion) {
    case OldAccountVersion.v0_2_0:
    case OldAccountVersion.v0_2_1:
    case OldAccountVersion.v0_2_2:
      currentSigner = num.toHexString((await accountContract.get_signer()).signer);
      currentGuardian = num.toHexString((await accountContract.get_guardian()).guardian);
      break;
    case OldAccountVersion.v0_2_3_0:
    case OldAccountVersion.v0_2_3_1:
      currentSigner = num.toHexString(await provider.getStorageAt(accountAddress, selector.starknetKeccak("_signer")));
      currentGuardian = num.toHexString(
        await provider.getStorageAt(accountAddress, selector.starknetKeccak("_guardian")),
      );
      break;
    case OldAccountVersion.v0_3_0:
    case OldAccountVersion.v0_3_1:
      currentSigner = num.toHexString(await accountContract.get_owner());
      currentGuardian = num.toHexString(await accountContract.get_guardian());
      break;
    default:
      throw new Error("Unsupported version for verification of owner and guardian");
  }

  logger.log("currentSigner", num.toBigInt(currentSigner));
  logger.log("currentGuardian", num.toBigInt(currentGuardian));
  if (num.toBigInt(currentSigner) !== keyPair.publicKey) {
    throw new Error("Signer doesn't match private key");
  }
  if (currentGuardian !== "0x0") {
    throw new Error("Account has a guardian, can't upgrade");
  }
}

// Upgrades an old Ready account to the newest version possible. It is impossible in some cases, because of technical
// reasons to directly upgrade to the latest version. For this reason, the upgrade is done in multiple steps if necessary.
// @returns Transaction hash of the upgrade transaction, or a Call that needs to be executed by another account,
// or null if the account is already at the latest version
export async function upgradeOldContract(
  logger: ILogger,
  accountAddress: string,
  privateKey: string,
): Promise<string | Call | null> {
  logger.log("upgrading old account:", accountAddress);

  const [accountVersion, accountProxyType, implementationClassHash] = await getAccountVersion(logger, accountAddress);

  if (accountVersion === OldAccountVersion.v0_4_0) {
    return null;
  }

  logger.log("account version", OldAccountVersion[accountVersion]);
  logger.log("proxy type", ProxyType[accountProxyType]);
  await verifyAccountOwnerAndGuardian(logger, accountAddress, privateKey, accountVersion, implementationClassHash);

  switch (accountVersion) {
    case OldAccountVersion.v0_2_0:
    case OldAccountVersion.v0_2_1:
    case OldAccountVersion.v0_2_2:
      return upgradeV0(logger, accountAddress, privateKey, implementationClassHash, accountProxyType, accountVersion);
    case OldAccountVersion.v0_2_3_0:
    case OldAccountVersion.v0_2_3_1:
      return upgradeFrom_0_2_3(logger, accountAddress, privateKey, accountProxyType);
    case OldAccountVersion.v0_3_0:
    case OldAccountVersion.v0_3_1:
      const upgrade_0_4_call = await upgrade_from_0_3_efo(logger, accountAddress, privateKey);
      return upgrade_0_4_call;
  }
}

export async function upgradeFrom_0_2_3(
  logger: ILogger,
  accountAddress: string,
  privateKey: string,
  proxyType: ProxyType,
  targetImplementationClassHash = v0_4_0_implementationClassHash,
  upgradeCalldata = [0],
): Promise<string> {
  if (proxyType === ProxyType.NoProxy) {
    throw new Error("Old version must have a proxy");
  }
  const accountToUpgrade = new Account(provider, accountAddress, privateKey);

  const nonce = await provider.getNonceForAddress(accountAddress);
  logger.log("nonce", nonce);

  const call = {
    contractAddress: accountAddress,
    entrypoint: "upgrade",
    calldata: CallData.compile({ implementation: targetImplementationClassHash, calldata: upgradeCalldata }),
  };

  try {
    const submitResult = await accountToUpgrade.execute([call]);
    logger.log("upgrade to v0.4.0 transaction hash", submitResult.transaction_hash);
    return submitResult.transaction_hash;
  } catch (err) {
    if (err instanceof Error && err.message.includes("exceed balance")) {
      logger.log("Not enough STRK to pay for the upgrade transaction", err.message);
      throw new Error("Not enough STRK to pay for the upgrade transaction");
    }
    throw err;
  }
}

export async function upgradeV0(
  logger: ILogger,
  accountAddress: string,
  privateKey: string,
  implementationClassHash: string,
  proxyType: ProxyType,
  currentVersion: OldAccountVersion,
  targetImplementationClassHash = v0_2_3_1_implementationClassHash,
  targetImplementationAddress = v0_2_3_1_implementationAddress,
): Promise<Call> {
  if (proxyType === ProxyType.NoProxy) {
    throw new Error("Old version must have a proxy");
  }
  if (proxyType === ProxyType.OldProxy && currentVersion === OldAccountVersion.v0_2_2) {
    throw new Error("v0.2.2 with old proxy is not supported");
  }
  const { abi } = await provider.getClassByHash(implementationClassHash);
  const accountContract = new Contract(abi, accountAddress, provider);

  const nonce = (await accountContract.get_nonce()).nonce;
  logger.log("nonce", nonce);

  let upgradeTargetClassHashOrAddress = (() => {
    if (proxyType === ProxyType.NewProxy) {
      return targetImplementationClassHash;
    } else {
      return targetImplementationAddress;
    }
  })();

  const call = {
    to: accountAddress,
    selector: hash.getSelector("upgrade"),
    calldata: [upgradeTargetClassHashOrAddress],
  };
  const unsignedRequest = {
    type: "INVOKE",
    max_fee: num.toHexString(0),
    version: "0x0",
    contract_address: accountAddress,
    entry_point_selector: hash.getSelector("__execute__"),
    calldata: [
      "0x1", // call_array_len
      call.to, // to
      call.selector, // selector
      "0x0", // data_offset
      num.toHex(call.calldata.length), // call_data_len
      num.toHex(call.calldata.length), // data_len
      ...call.calldata, // call_data
      num.toHex(nonce), // nonce
    ],
  };

  const msgHashToSign = await (async () => {
    if (implementationClassHash === v0_2_0_implementationClassHash) {
      const calldataHash = hash.computeHashOnElements(call.calldata);
      const callHash = hash.computeHashOnElements([call.to, call.selector, calldataHash]);
      const callsHash = hash.computeHashOnElements([callHash]);
      return hash.computeHashOnElements([
        shortString.encodeShortString("StarkNet Transaction"),
        accountAddress,
        callsHash,
        nonce,
        0, // max_fee
        0, // version
      ]);
    } else {
      return v2hash.calculateTransactionHashCommon(
        constants.TransactionHashPrefix.INVOKE,
        unsignedRequest.version,
        unsignedRequest.contract_address,
        unsignedRequest.entry_point_selector,
        unsignedRequest.calldata,
        unsignedRequest.max_fee,
        await provider.getChainId(),
      );
    }
  })();

  const signatureObj = ec.starkCurve.sign(msgHashToSign, privateKey) as any;
  const signatureArray = [num.toHexString(signatureObj["r"]), num.toHexString(signatureObj["s"])];

  const metatx_calldata = CallData.compile({
    target: unsignedRequest.contract_address,
    entry_point_selector: unsignedRequest.entry_point_selector,
    calldata: unsignedRequest.calldata,
    signature: signatureArray,
  });

  const upgrade_0_2_3_1_call = {
    contractAddress: meta_v0_contract_address,
    entrypoint: "execute_meta_tx_v0",
    calldata: metatx_calldata,
  };

  logger.log(`Go to https://voyager.online/contract/${upgrade_0_2_3_1_call.contractAddress}#writeContract`);
  logger.log(
    `Go to "Write Contract". Connect with another funded account. Expand "${upgrade_0_2_3_1_call.entrypoint}" function.`,
  );
  logger.log(`Paste the following calldata:`);
  logger.log(upgrade_0_2_3_1_call.calldata.join(", "));
  logger.log("After this transaction is confirmed, you need to trigger another upgrade by using this tool again");

  return upgrade_0_2_3_1_call;
}

export async function upgrade_from_0_3_efo(logger: ILogger, accountAddress: string, privateKey: string): Promise<Call> {
  const outsideExec = {
    caller: shortString.encodeShortString("ANY_CALLER"),
    nonce: stark.randomAddress(),
    execute_after: 0,
    execute_before: Math.floor(Date.now() / 1000 + 86400 * 7), // one week from now
    calls: [
      getOutsideCall({
        contractAddress: accountAddress,
        entrypoint: "upgrade",
        calldata: CallData.compile({ newClassHash: v0_4_0_implementationClassHash, calldata: [] }),
      }),
    ],
  };
  const upgrade_0_4_call = await getOutsideExecutionCall(
    outsideExec,
    accountAddress,
    privateKey,
    await provider.getChainId(),
  );

  const calldata = upgrade_0_4_call.calldata! as string[];
  logger.log(`Go to https://voyager.online/contract/${upgrade_0_4_call.contractAddress}#writeContract`);
  logger.log(
    `Go to "Write Contract". Connect with another funded account. Expand "${upgrade_0_4_call.entrypoint}" function.`,
  );
  logger.log(`Paste the following calldata:`);
  logger.log(calldata.join(", "));
  logger.log("After this transaction is confirmed, you need to trigger another upgrade by using this tool again");

  return upgrade_0_4_call;
}
