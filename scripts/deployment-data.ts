import { CallData, hash, num, transaction } from "starknet";
import {
  udcContractAddress,
  v0_2_0_implementationClassHash,
  v0_2_0_proxyClassHash,
  v0_2_1_implementationClassHash,
  v0_2_2_implementationClassHash,
  v0_2_2_proxyClassHash,
  v0_2_3_0_implementationClassHash,
  v0_2_3_1_implementationClassHash,
} from "../frontend/services";

// Put here the account's public key
const owner = BigInt("0x1");
const contractAddressToFind = BigInt("0x1");

const proxies = [v0_2_2_proxyClassHash, v0_2_0_proxyClassHash];

const oldArgentAccountClassHashes = [
  v0_2_0_implementationClassHash,
  v0_2_1_implementationClassHash,
  v0_2_2_implementationClassHash,
  v0_2_3_0_implementationClassHash,
  v0_2_3_1_implementationClassHash,
];

for (const proxyClassHash of proxies) {
  for (const oldArgentAccountClassHash of oldArgentAccountClassHashes) {
    const constructorCalldata = CallData.compile({
      implementation: oldArgentAccountClassHash,
      selector: hash.getSelectorFromName("initialize"),
      calldata: CallData.compile({ owner, guardian: 0 }),
    });

    const contractAddress = hash.calculateContractAddressFromHash(owner, proxyClassHash, constructorCalldata, 0);
    if (BigInt(contractAddress) === contractAddressToFind) {
      const { calls } = transaction.buildUDCCall(
        {
          classHash: proxyClassHash,
          salt: num.toHex(owner),
          constructorCalldata,
          unique: false,
        },
        udcContractAddress,
      );
      console.log("Open the UDC at https://voyager.online/contract/" + udcContractAddress + "#writeContract");
      console.log("deploy_contract_calldata: \n", calls[0].calldata.join(", "));
      process.exit(0);
    }
  }
}

console.log("Contract not found");
