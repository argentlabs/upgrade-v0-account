import {
  deployOldAccount_v0_2_2,
  v0_2_2_proxyClassHash,
  v0_2_2_implementationClassHash,
  deployOldAccount_v0_2_0_proxy,
  v0_2_0_proxyClassHash,
  v0_2_1_implementationAddress,
  v0_2_1_implementationClassHash,
  v0_2_0_implementationAddress,
  v0_2_0_implementationClassHash,
} from "../frontend/services";

describe("ArgentAccount", function () {
  const salt = 5656n;

  // it(`Deploy 0.2.2 account`, async function () {
  //   await deployOldAccount_v0_2_2(
  //     v0_2_2_proxyClassHash,
  //     v0_2_2_implementationClassHash,
  //     "0.2.2",
  //     200000000000000n,
  //     salt,
  //   );
  // });

  // it(`Deploy 0.2.1 account`, async function () {
  //   await deployOldAccount_v0_2_0_proxy(
  //     v0_2_0_proxyClassHash, // in prod  0.2.1 accounts used the 0.2.0 proxy
  //     v0_2_1_implementationAddress,
  //     v0_2_1_implementationClassHash,
  //     "0.2.1",
  //     200000000000000n,
  //     salt,
  //   );
  // });
  // it(`Deploy 0.2.0 account`, async function () {
  //   await deployOldAccount_v0_2_0_proxy(
  //     v0_2_0_proxyClassHash,
  //     v0_2_0_implementationAddress,
  //     v0_2_0_implementationClassHash,
  //     "0.2.0",
  //     200000000000000n,
  //     salt,
  //   );
  // });
});
