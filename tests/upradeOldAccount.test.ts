import { deprecatedAccountList, deployOldAccount, sendEth, upgradeOldContract } from "./lib";

describe("ArgentAccount", function () {
  for (const { version, implementation, proxy } of deprecatedAccountList) {
    it(`Upgrade from ${version}`, async function () {
      // deploy account
      // await deployOldAccount(implementation, proxy, version, fundAmount, 5000000000000000n);
      // try to upgrade
      // await upgradeOldContract("0x2bdc67e5e9585a0881d850145186a15df63ea8c243b6058fe0cd446d3fe2e44");
    });
  }
});
