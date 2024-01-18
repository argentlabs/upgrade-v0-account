import { deprecatedAccountList, deployOldAccount } from "./lib";

describe("ArgentAccount", function () {
  // for (const { version, classHash, proxy } of deprecatedAccountList) {

  it(`Upgrade from  to 0.2.3.1`, async function () {
    // deploy accounts
    await deployOldAccount();
    // try to upgrade
  });
  // }
});
