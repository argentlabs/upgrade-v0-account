import dotenv from "dotenv";
import { sendPreparedCall, upgradeOldContract } from "../frontend/services";

dotenv.config({ override: true });
const address = process.env.ADDRESS!;
const privateKey = process.env.PRIVATE_KEY!;
const { RELAYER_ADDRESS, RELAYER_PRIVATE_KEY } = process.env;

const result = await upgradeOldContract(console, address, privateKey);
if (result !== null && typeof result !== "string" && RELAYER_ADDRESS && RELAYER_PRIVATE_KEY) {
  console.log(`Sending this step from ${RELAYER_ADDRESS}`);
  await sendPreparedCall(console, address, RELAYER_ADDRESS, RELAYER_PRIVATE_KEY, result);
  await upgradeOldContract(console, address, privateKey);
}
