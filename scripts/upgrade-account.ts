import { upgradeOldContract } from "../frontend/services";
await upgradeOldContract(console, process.env.ADDRESS!, process.env.PRIVATE_KEY!);
