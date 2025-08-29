import {
  Account,
  Contract,
  num,
  hash,
  ec,
  constants,
  shortString,
  CallData,
  stark,
  UINT_256_MAX,
  selector,
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
  v0_3_1_implementationAddress,
  v0_3_1_implementationClassHash,
  v0_4_0_implementationClassHash,
  v0_3_0_implementationClassHash,
} from ".";

const meta_v0_contract_address = "0x3e21ab91c0899efc48b6d6ccd09b61fd37766e9b0c3cc968a7655632fbc253c";

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

enum ProxyType {
  OldProxy,
  NewProxy,
  NoProxy,
}

export async function getAccountVersion(accountAddress: string): Promise<[OldAccountVersion, ProxyType, string]> {
  const accountContract = await loadContract(accountAddress);
  const accountClassHash = await provider.getClassHashAt(accountAddress);

  console.log("account class hash", accountClassHash);
  if (accountClassHash === v0_4_0_implementationClassHash) {
    return [OldAccountVersion.v0_4_0, ProxyType.NoProxy, accountClassHash];
  }

  let proxyType: ProxyType;
  let implementationClassHash: string;
  if (accountClassHash === v0_2_2_proxyClassHash) {
    implementationClassHash = num.toHexString((await accountContract.get_implementation()).implementation);
    proxyType = ProxyType.NewProxy;
  } else if (accountClassHash === v0_2_0_proxyClassHash) {
    const implementationAddress = num.toHexString((await accountContract.get_implementation()).implementation);
    console.log("implementationAddress", implementationAddress);
    implementationClassHash = await provider.getClassHashAt(implementationAddress);
    proxyType = ProxyType.OldProxy;
  } else {
    throw new Error("Unrecognized proxy");
  }

  console.log("implementationClassHash", implementationClassHash);

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
    default:
      throw new Error("Unknown implementation class hash");
  }
  return [version, proxyType, implementationClassHash];
}

export async function upgradeOldContract(accountAddress: string, privateKey: string): Promise<string> {
  console.log("upgrading old account:", accountAddress);

  const [accountVersion, accountProxyType, implementationClassHash] = await getAccountVersion(accountAddress);
  console.log("account version", accountVersion);
  console.log("proxy type", accountProxyType);

  switch (accountVersion) {
    case OldAccountVersion.v0_4_0:
      throw new Error("Account is already at latest version");
    case OldAccountVersion.v0_2_0:
    case OldAccountVersion.v0_2_1:
    case OldAccountVersion.v0_2_2:
      return upgradeV0(accountAddress, privateKey, implementationClassHash, accountProxyType);
    case OldAccountVersion.v0_2_3_0:
    case OldAccountVersion.v0_2_3_1:
      return upgradeV1(accountAddress, privateKey, implementationClassHash, accountProxyType);
    case OldAccountVersion.v0_3_0:
    case OldAccountVersion.v0_3_1:
      const upgrade_0_4_call = await upgrade_from_0_3_1_efo(accountAddress, privateKey);
      console.log(JSON.stringify([upgrade_0_4_call], null, 2));
      return "";
  }
}

async function upgradeV1(
  accountAddress: string,
  privateKey: string,
  implementationClassHash: string,
  proxyType: ProxyType,
): Promise<string> {
  if (proxyType !== ProxyType.NewProxy) {
    throw new Error("v0.2.3.x must have new proxy");
  }
  const keyPair = new KeyPair(privateKey);
  const accountToUpgrade = new Account(provider, accountAddress, privateKey);
  const currentSigner = num.toHexString(
    await provider.getStorageAt(accountAddress, selector.starknetKeccak("_signer")),
  );
  if (num.toBigInt(currentSigner) !== keyPair.publicKey) {
    throw new Error("Signer doesn't match private key");
  }
  const currentGuardian = num.toHexString(
    await provider.getStorageAt(accountAddress, selector.starknetKeccak("_guardian")),
  );
  if (currentGuardian !== "0x0") {
    throw new Error("Account has a guardian, can't upgrade");
  }

  // FIXME: estimate v3 tx
  const nonce = await provider.getNonceForAddress(accountAddress);
  console.log("nonce", nonce);

  const call = {
    contractAddress: accountAddress,
    entrypoint: "upgrade",
    calldata: CallData.compile({ implementation: v0_3_1_implementationClassHash, calldata: [] }),
  };

  const submitResult = await accountToUpgrade.execute([call], undefined);
  console.log("upgrade to v0.3.1 transaction hash", submitResult.transaction_hash);
  await provider.waitForTransaction(submitResult.transaction_hash);
  console.log("Upgraded to v0.3.1. Run again to upgrade to latest version");
  return submitResult.transaction_hash;
}

async function upgradeV0(
  accountAddress: string,
  privateKey: string,
  implementationClassHash: string,
  proxyType: ProxyType,
): Promise<string> {
  if (proxyType === ProxyType.NoProxy) {
    throw new Error("Old version must have a proxy");
  }

  const keyPair = new KeyPair(privateKey);
  const { abi } = await provider.getClassByHash(implementationClassHash);
  const accountContract = new Contract(abi, accountAddress, provider);

  const currentSigner = num.toHexString((await accountContract.get_signer()).signer);
  console.log("currentSigner", num.toBigInt(currentSigner));
  console.log("keyPair.pubKey", keyPair.publicKey);
  if (num.toBigInt(currentSigner) !== keyPair.publicKey) {
    throw new Error("Signer doesn't match private key");
  }

  const currentGuardian = num.toHexString((await accountContract.get_guardian()).guardian);
  if (currentGuardian !== "0x0") {
    throw new Error("Account has a guardian, can't upgrade");
  }

  const nonce = (await accountContract.get_nonce()).nonce;
  console.log("nonce", nonce);

  let upgradeTargetClassHashOrAddress = (() => {
    if (proxyType === ProxyType.NewProxy) {
      return v0_3_1_implementationClassHash;
    } else {
      return v0_3_1_implementationAddress;
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
      num.toHex(call.calldata.length), // data_len
      "0x1", // call_data_len
      upgradeTargetClassHashOrAddress, // call_data
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
        0,
        0,
      ]);
    } else {
      // based on: https://github.com/starknet-io/starknet.js/blob/v5.24.3/src/utils/hash.ts#L68
      // https://docs.starknet.io/resources/transactions-reference/#invoke_v0
      const calldataHash = hash.computeHashOnElements(unsignedRequest.calldata);
      return hash.computeHashOnElements([
        shortString.encodeShortString("invoke"),
        unsignedRequest.version,
        unsignedRequest.contract_address,
        unsignedRequest.entry_point_selector,
        calldataHash,
        unsignedRequest.max_fee,
        await provider.getChainId(),
      ]);
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

  const updgrade_0_3_1_call = {
    contract_address: meta_v0_contract_address,
    entry_point: "execute_meta_tx_v0",
    calldata: metatx_calldata,
  };

  const upgrade_0_4_call = await upgrade_from_0_3_1_efo(accountAddress, privateKey);

  console.log(JSON.stringify([updgrade_0_3_1_call, upgrade_0_4_call], null, 2));
  return "";
}

export async function upgrade_from_0_3_1_efo(accountAddress: string, privateKey: string): Promise<any> {
  const outsideExec = {
    caller: shortString.encodeShortString("ANY_CALLER"),
    nonce: 1234n, // stark.randomAddress(),
    execute_after: 0,
    execute_before: Math.floor(Date.now() / 1000 + 86400), // one day from now
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

  return {
    contract_address: upgrade_0_4_call.contractAddress,
    entry_point: upgrade_0_4_call.entrypoint,
    calldata: num.bigNumberishArrayToHexadecimalStringArray(upgrade_0_4_call.calldata as any),
  };
}
