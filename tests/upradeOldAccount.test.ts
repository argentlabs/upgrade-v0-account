import { deprecatedAccountList, deployOldAccount, sendEth, upgradeOldContract } from "./lib";

describe("ArgentAccount", function () {
  for (const { version, classHash, proxy } of deprecatedAccountList) {
    it(`Upgrade from ${version} to 0.2.3.1`, async function () {
      // deploy accounts
      await deployOldAccount(classHash, proxy, version);
      // try to upgrade
    });
  }
});
