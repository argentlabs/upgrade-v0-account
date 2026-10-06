"use client";

import { useState } from "react";
import { Account, Call, constants, num, TransactionType, WalletAccount, wallet } from "starknet";

import { Button } from "@/components/ui/button";
import { provider } from "@/services";

// Minimal shape of the wallet object a Starknet browser extension injects as window.starknet_<id>.
interface InjectedWallet {
  id: string;
  name: string;
  request: (...args: any[]) => Promise<any>;
  on: (...args: any[]) => void;
}

interface Logger {
  log: (...args: any[]) => void;
}

type Phase = "idle" | "connecting" | "checking" | "ready" | "sending" | "confirming" | "done" | "error";

// Ready X registers as "argentX" and is used when several wallets are installed.
const preferredWalletId = "argentX";

// Wallets inject themselves as window.starknet and window.starknet_<id>. Some define these as
// non-enumerable properties, so Object.keys(window) would miss them.
function findInjectedWallet(): InjectedWallet | undefined {
  const wallets = new Map<string, InjectedWallet>();
  for (const key of Object.getOwnPropertyNames(window)) {
    if (!key.startsWith("starknet")) continue;
    const candidate = (window as any)[key];
    if (candidate && typeof candidate.request === "function" && typeof candidate.id === "string") {
      wallets.set(candidate.id, candidate);
    }
  }
  return wallets.get(preferredWalletId) ?? wallets.values().next().value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Sends a prepared call (for example the step that upgrades an old account) from another account the user
// controls in a browser wallet. Fees for this call cannot be estimated (a fee query changes the hash the old
// account checks), so the page verifies the call by simulation before handing it to the wallet. Details of any
// failure go to the logs; the panel only asks the user to share them.
export const SendFromWallet = ({
  preparedCall,
  accountAddress,
  logger,
  onConfirmed,
  onCancel,
}: {
  preparedCall: Call;
  accountAddress: string;
  logger: Logger;
  onConfirmed: () => void;
  onCancel: () => void;
}) => {
  // The wallet API expects calldata as hex felts.
  const call: Call = {
    ...preparedCall,
    calldata: (preparedCall.calldata as string[]).map((value) => num.toHex(value)),
  };
  const [walletAccount, setWalletAccount] = useState<WalletAccount | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [canRetrySend, setCanRetrySend] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string>("");

  const fail = (reason: string) => {
    logger.log(`Another account step failed: ${reason}`);
    setPhase("error");
  };

  const runChecks = async (connectedAccount: WalletAccount, injectedWallet: InjectedWallet) => {
    setPhase("checking");
    logger.log(`Connected account: ${connectedAccount.address}`);

    const chainId = await wallet.requestChainId(injectedWallet as any);
    if (BigInt(chainId) !== BigInt(constants.StarknetChainId.SN_MAIN)) {
      fail(`the wallet is on chain ${chainId}, not Starknet mainnet. Switch the wallet to mainnet and connect again.`);
      return;
    }
    if (BigInt(connectedAccount.address) === BigInt(accountAddress)) {
      fail("the connected account is the account being upgraded. Select a different account in the wallet.");
      return;
    }
    try {
      // Same call, simulated from the connected account without its signature.
      const simulationAccount = new Account({ provider, address: connectedAccount.address, signer: "0x1" });
      const [simulation] = await simulationAccount.simulateTransaction([
        { type: TransactionType.INVOKE, payload: call },
      ]);
      const revertReason = (simulation.transaction_trace as any).execute_invocation?.revert_reason;
      if (revertReason) {
        fail(`simulating the call from the connected account reverted: ${revertReason}`);
        return;
      }
    } catch (error) {
      fail(`simulating the call from the connected account failed: ${errorMessage(error)}`);
      return;
    }
    logger.log("Checks passed: mainnet, a different account, and the call succeeds in simulation.");
    setPhase("ready");
  };

  const connect = async () => {
    const injectedWallet = findInjectedWallet();
    if (!injectedWallet) {
      fail("no Starknet wallet extension was found in this browser.");
      return;
    }
    setPhase("connecting");
    try {
      const connectedAccount = await WalletAccount.connect(provider, injectedWallet as any);
      setWalletAccount(connectedAccount);
      await runChecks(connectedAccount, injectedWallet);
    } catch (error) {
      fail(`connecting the wallet failed: ${errorMessage(error)}`);
    }
  };

  const send = async () => {
    if (!walletAccount) return;
    setPhase("sending");
    setCanRetrySend(false);
    let sentTransactionHash = "";
    try {
      const { transaction_hash } = await walletAccount.execute([call]);
      sentTransactionHash = transaction_hash;
      setTransactionHash(transaction_hash);
      logger.log(`Transaction sent: ${transaction_hash}`);
      setPhase("confirming");
      const receipt = await provider.waitForTransaction(transaction_hash);
      if (!receipt.isSuccess()) {
        fail(`transaction ${transaction_hash} was included but did not succeed: ${JSON.stringify(receipt.value)}`);
        return;
      }
      logger.log(`Transaction confirmed: ${transaction_hash}`);
      setPhase("done");
      onConfirmed();
    } catch (error) {
      if (!sentTransactionHash) setCanRetrySend(true);
      fail(`sending the transaction failed: ${errorMessage(error)}`);
    }
  };

  return (
    <div className="font-barlow border border-[#FF875B] p-5 rounded-lg shadow-lg bg-white mt-5">
      <h3 className="text-lg font-medium mb-2">Use another account to upgrade</h3>
      <p className="text-sm text-gray-700 mb-3">
        This step has to be sent from a different Starknet account. Connect a wallet with that account. The private key
        you entered above is never shared with the wallet.
      </p>

      {!walletAccount && (
        <Button type="button" onClick={connect} disabled={phase === "connecting"}>
          Connect wallet
        </Button>
      )}

      {walletAccount && (
        <p className="text-sm mb-2 break-all">
          Connected account: <span className="font-mono">{walletAccount.address}</span>
        </p>
      )}

      {phase === "checking" && <p className="text-sm">Checking the connected account...</p>}
      {(phase === "ready" || (phase === "error" && canRetrySend)) && (
        <Button type="button" className="mr-2" onClick={send}>
          Send with connected wallet
        </Button>
      )}
      {phase === "sending" && <p className="text-sm">Confirm the transaction in your wallet...</p>}
      {transactionHash && (
        <p className="text-sm break-all">
          Transaction:{" "}
          <a
            className="underline"
            href={`https://voyager.online/tx/${transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {transactionHash}
          </a>
        </p>
      )}
      {phase === "confirming" && <p className="text-sm">Waiting for the transaction to be confirmed...</p>}
      {phase === "done" && (
        <p className="text-sm font-medium">
          Confirmed. Click &quot;Upgrade Account&quot; again to continue with the next step.
        </p>
      )}
      {phase === "error" && (
        <p className="text-sm text-red-600 mt-2">Something went wrong. Please share the logs below with us.</p>
      )}
      {walletAccount && phase === "error" && (
        <Button
          type="button"
          className="mt-2"
          onClick={() => {
            setWalletAccount(null);
            setCanRetrySend(false);
            setPhase("idle");
          }}
        >
          Connect wallet again
        </Button>
      )}
      {phase !== "sending" && phase !== "confirming" && phase !== "done" && (
        <div className="mt-3">
          <button type="button" className="text-sm underline text-gray-600" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
