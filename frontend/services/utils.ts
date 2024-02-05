import { Account, RpcProvider, Signer, encode, ec, CallData, Contract, uint256, num } from "starknet";

export const provider = new RpcProvider({ nodeUrl: "https://starknet-mainnet.public.blastapi.io" });
export const ethAddress = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

export async function getEthBalance(contractAddress: string): Promise<bigint> {
  const ethContract = await getEthContract();
  return uint256.uint256ToBN((await ethContract.balanceOf(contractAddress)).balance);
}

let ethContract: Contract;

export async function getEthContract() {
  if (ethContract) {
    return ethContract;
  }
  const ethProxy = await loadContract(ethAddress);
  if (ethProxy.abi.some((entry) => entry.name == "implementation")) {
    const implementationAddress = num.toHex((await ethProxy.implementation()).address);
    const ethImplementation = await loadContract(implementationAddress);
    ethContract = new Contract(ethImplementation.abi, ethAddress, ethProxy.providerOrAccount);
  } else {
    ethContract = ethProxy;
  }
  return ethContract;
}

export async function loadContract(contractAddress: string, classHash?: string): Promise<Contract> {
  const { abi } = await provider.getClassAt(contractAddress);
  if (!abi) {
    throw new Error("Error while getting ABI");
  }
  return new Contract(abi, contractAddress, provider);
}

export class KeyPair extends Signer {
  constructor(pk?: string | bigint) {
    super(pk ? `${pk}` : `0x${encode.buf2hex(ec.starkCurve.utils.randomPrivateKey())}`);
  }

  public get privateKey() {
    return BigInt(this.pk as string);
  }

  public get publicKey() {
    return BigInt(ec.starkCurve.getStarkKey(this.pk));
  }
}

export const latestAccountClassHash_V_0_2_3_1 = "0x033434ad846cdd5f23eb73ff09fe6fddd568284a0fb7d1be20ee482f044dabe2";
export const v0_2_2_implementation = "0x3e327de1c40540b98d05cbcb13552008e36f0ec8d61d46956d2f9752c294328";

export const deprecatedAccountList = [
  {
    version: "0.2.2",
    implementation: v0_2_2_implementation,
    proxy: "0x25ec026985a3bf9d0cc1fe17326b245dfdc3ff89b8fde106542a3ea56c5a918",
  },
  // TODO upgrading from versions older than 0.2.2 is not tested yet
  // {
  //   version: "0.2.0",
  //   implementation: "0x07595b4f7d50010ceb00230d8b5656e3c3dd201b6df35d805d3f2988c69a1432",
  //   proxy: "0x071c3c99f5cf76fc19945d4b8b7d34c7c5528f22730d56192b50c6bbfd338a64",
  // },
  // {
  //   version: "0.2.1",
  //   implementation: "0x06a1776964b9f991c710bfe910b8b37578b32b26a7dffd1669a1a59ac94bf82f",
  //   proxy: "0x08f1dae4382de84c1ab18cc73d38578f3ef70b2174ac9a54a1c4ae165ea668c",
  // },
];
