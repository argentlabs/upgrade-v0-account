import { upgradeOldContract } from "../tests/lib";

await upgradeOldContract("0x021359953fd677f35dbf2b23ead81498c071ddf2816b1954f2430760275aece6", process.env.PRIVATE_KEY!);