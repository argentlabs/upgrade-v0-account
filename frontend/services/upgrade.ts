import { Account, Contract, num, hash, ec, constants, shortString, CallData } from "starknet";
import {
  getEthBalance,
  provider,
  loadContract,
  KeyPair,
  v0_2_2_implementationClassHash,
  v0_2_2_proxyClassHash,
  v0_2_0_proxyClassHash,
  v0_2_1_implementationClassHash,
  v0_2_0_implementationClassHash,
  latestAccountClassHash_V_0_2_3_1_classHash,
  latestAccountClassHash_V_0_2_3_1_address,
} from ".";

const meta_v0_contract_address = "0x3e21ab91c0899efc48b6d6ccd09b61fd37766e9b0c3cc968a7655632fbc253c";

export async function upgradeOldContract(accountAddress: string, privateKey: string): Promise<string> {
  console.log("upgrading old account:", accountAddress);
  const keyPair = new KeyPair(privateKey);
  const accountToUpgrade = new Account(provider, accountAddress, privateKey);
  const proxyContract = await loadContract(accountAddress);
  const proxyClassHash = await accountToUpgrade.getClassHashAt(accountAddress);
  console.log("proxyClassHash", proxyClassHash);
  let implementationClassHash, newProxy;
  if (proxyClassHash === v0_2_2_proxyClassHash) {
    implementationClassHash = num.toHexString((await proxyContract.get_implementation()).implementation);
    newProxy = true;
  } else if (proxyClassHash === v0_2_0_proxyClassHash) {
    const implementationAddress = num.toHexString((await proxyContract.get_implementation()).implementation);
    console.log("implementationAddress", implementationAddress);
    implementationClassHash = await provider.getClassHashAt(implementationAddress);
    newProxy = false;
  } else {
    throw new Error("Unrecognized proxy");
  }
  console.log("implementationClassHash", implementationClassHash);
  console.log("newProxy", newProxy);

  if (implementationClassHash === latestAccountClassHash_V_0_2_3_1_classHash) {
    throw new Error("Account is in 0.2.3.1, use argent X to upgrade to newer versions");
  } else if (implementationClassHash === v0_2_2_implementationClassHash) {
    if (!newProxy) {
      // TODO: check why this is not supported
      throw new Error("version 0.2.2 with old proxy not supported");
    }
    console.log("upgrading from v0.2.2");
  } else if (implementationClassHash === v0_2_1_implementationClassHash) {
    if (newProxy) {
      throw new Error("version 0.2.1 with new proxy not supported");
    }
    console.log("upgrading from v0.2.1");
  } else if (implementationClassHash === v0_2_0_implementationClassHash) {
    if (newProxy) {
      throw new Error("version 0.2.0 with new proxy not supported");
    }
    console.log("upgrading from v0.2.0");
  } else {
    throw new Error("Unknown implementation class hash");
  }

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
    if (newProxy) {
      return latestAccountClassHash_V_0_2_3_1_classHash;
    } else {
      return latestAccountClassHash_V_0_2_3_1_address;
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

  console.log(
    JSON.stringify(
      [
        {
          contract_address: meta_v0_contract_address,
          entry_point: "execute_meta_tx_v0",
          calldata: metatx_calldata,
        },
      ],
      null,
      2,
    ),
  );
  return "";
}
