import { upgradeOldContract } from "../frontend/services";
await upgradeOldContract(process.env.ADDRESS!, process.env.PRIVATE_KEY!);
