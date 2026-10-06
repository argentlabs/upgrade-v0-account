"use client";

import { useState } from "react";
import { Account, Call, constants, num, TransactionType, WalletAccount, wallet } from "starknet";

import { Button } from "@/components/ui/button";
import { getStrkBalance, provider } from "@/services";

// Minimal shape of the wallet object a Starknet browser extension injects as window.starknet_<id>.
interface InjectedWallet {
  id: string;
  name: string;
  request: (...args: any[]) => Promise<any>;
  on: (...args: any[]) => void;
}

interface Check {
  label: string;
  passed: boolean;
  detail?: string;
}

type Phase = "idle" | "connecting" | "checking" | "ready" | "sending" | "confirming" | "done" | "error";

function findInjectedWallets(): InjectedWallet[] {
  const wallets = new Map<string, InjectedWallet>();
  for (const key of Object.keys(window)) {
    if (!key.startsWith("starknet")) continue;
    const candidate = (window as any)[key];
    if (candidate && typeof candidate.request === "function" && typeof candidate.id === "string") {
      wallets.set(candidate.id, candidate);
    }
  }
  return [...wallets.values()];
}

function formatStrk(amount: bigint): string {
  return (Number(amount) / 1e18).toFixed(4);
}

// Sends a prepared call (for example the step that upgrades an old account) from another account the user
// controls in a browser wallet. Fees for this call cannot be estimated (a fee query changes the hash the old
// account checks), so the page verifies the call by simulation before handing it to the wallet.
export const SendFromWallet = ({ preparedCall, accountAddress }: { preparedCall: Call; accountAddress: string }) => {
  // The wallet API expects calldata as hex felts.
  const call: Call = {
    ...preparedCall,
    calldata: (preparedCall.calldata as string[]).map((value) => num.toHex(value)),
  };
  const [wallets, setWallets] = useState<InjectedWallet[]>(() => findInjectedWallets());
  const [walletAccount, setWalletAccount] = useState<WalletAccount | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const allChecksPassed = checks.length > 0 && checks.every((check) => check.passed);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string>("");
  const [transactionHash, setTransactionHash] = useState<string>("");

  const runChecks = async (connectedAccount: WalletAccount, injectedWallet: InjectedWallet) => {
    setPhase("checking");
    const results: Check[] = [];

    const chainId = await wallet.requestChainId(injectedWallet as any);
    const isMainnet = BigInt(chainId) === BigInt(constants.StarknetChainId.SN_MAIN);
    results.push({
      label: "Wallet is on Starknet mainnet",
      passed: isMainnet,
      detail: isMainnet ? undefined : "Switch the wallet to Starknet mainnet and connect again.",
    });

    const isOtherAccount = BigInt(connectedAccount.address) !== BigInt(accountAddress);
    results.push({
      label: "Connected account is not the account being upgraded",
      passed: isOtherAccount,
      detail: isOtherAccount
        ? undefined
        : "Select a different account in the wallet: the old account cannot pay for this step.",
    });

    let maximumFee = 0n;
    if (isMainnet && isOtherAccount) {
      try {
        // Same call, simulated from the connected account without its signature.
        const simulationAccount = new Account({ provider, address: connectedAccount.address, signer: "0x1" });
        const [simulation] = await simulationAccount.simulateTransaction([
          { type: TransactionType.INVOKE, payload: call },
        ]);
        const revertReason = (simulation.transaction_trace as any).execute_invocation?.revert_reason;
        maximumFee = BigInt(simulation.overall_fee);
        results.push({
          label: "The call succeeds when simulated from this account",
          passed: !revertReason,
          detail: revertReason ? `Simulation reverted: ${revertReason}` : undefined,
        });
      } catch (error) {
        results.push({
          label: "The call succeeds when simulated from this account",
          passed: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }

      const balance = await getStrkBalance(connectedAccount.address);
      const hasFunds = maximumFee > 0n && balance >= maximumFee;
      results.push({
        label: `Account holds enough STRK for the fee (up to ${formatStrk(maximumFee)} STRK)`,
        passed: hasFunds,
        detail: hasFunds ? undefined : `Balance is ${formatStrk(balance)} STRK.`,
      });
    }

    setChecks(results);
    setPhase(results.every((check) => check.passed) ? "ready" : "error");
  };

  const connect = async (injectedWallet: InjectedWallet) => {
    setPhase("connecting");
    setMessage("");
    setChecks([]);
    try {
      const connectedAccount = await WalletAccount.connect(provider, injectedWallet as any);
      setWalletAccount(connectedAccount);
      await runChecks(connectedAccount, injectedWallet);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const send = async () => {
    if (!walletAccount) return;
    setPhase("sending");
    setMessage("");
    try {
      const { transaction_hash } = await walletAccount.execute([call]);
      setTransactionHash(transaction_hash);
      setPhase("confirming");
      const receipt = await provider.waitForTransaction(transaction_hash);
      if (!receipt.isSuccess()) {
        setPhase("error");
        setMessage("The transaction was included but did not succeed. Open it on Voyager for details.");
        return;
      }
      setPhase("done");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="font-barlow border border-[#FF875B] p-5 rounded-lg shadow-lg bg-white mt-5">
      <h3 className="text-lg font-medium mb-2">Send this step with another wallet</h3>
      <p className="text-sm text-gray-700 mb-3">
        This step has to be sent and paid for by a different Starknet account that holds some STRK. Connect a wallet
        with such an account. The wallet only receives the prepared call shown below; the private key you entered above
        is never shared with it.
      </p>
      <p className="text-sm text-gray-700 mb-3 break-all">
        Account being upgraded: <span className="font-mono">{accountAddress}</span>
        <br />
        Call: <span className="font-mono">{call.entrypoint}</span> on{" "}
        <span className="font-mono">{call.contractAddress}</span>
      </p>

      {!walletAccount && (
        <div className="flex flex-wrap gap-2 items-center">
          {wallets.map((injectedWallet) => (
            <Button
              key={injectedWallet.id}
              type="button"
              onClick={() => connect(injectedWallet)}
              disabled={phase === "connecting"}
            >
              Connect {injectedWallet.name}
            </Button>
          ))}
          {wallets.length === 0 && (
            <p className="text-sm text-gray-700">No Starknet wallet extension was found in this browser.</p>
          )}
          <button type="button" className="text-sm underline" onClick={() => setWallets(findInjectedWallets())}>
            Refresh wallet list
          </button>
        </div>
      )}

      {walletAccount && (
        <p className="text-sm mb-2 break-all">
          Connected account: <span className="font-mono">{walletAccount.address}</span>
        </p>
      )}

      {phase === "checking" && <p className="text-sm">Checking the connected account...</p>}
      {checks.length > 0 && (
        <ul className="text-sm mb-3">
          {checks.map((check) => (
            <li key={check.label}>
              {check.passed ? "✅" : "❌"} {check.label}
              {check.detail && <div className="text-gray-600 ml-6 break-all">{check.detail}</div>}
            </li>
          ))}
        </ul>
      )}

      {(phase === "ready" || (phase === "error" && allChecksPassed && !transactionHash)) && (
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
      {phase === "error" && message && <p className="text-sm text-red-600 break-all">{message}</p>}
      {walletAccount && phase === "error" && (
        <Button
          type="button"
          className="mt-2"
          onClick={() => {
            setWalletAccount(null);
            setChecks([]);
            setPhase("idle");
            setMessage("");
          }}
        >
          Connect a different wallet
        </Button>
      )}
    </div>
  );
};
