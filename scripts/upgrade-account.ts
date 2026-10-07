import dotenv from "dotenv";
import { upgradeOldContract } from "../frontend/services";

dotenv.config({ override: true });
await upgradeOldContract(console, process.env.ADDRESS!, process.env.PRIVATE_KEY!);
