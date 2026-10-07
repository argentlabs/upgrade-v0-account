"use client";

import { useState, useEffect, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Call } from "starknet";

import { InfoModal } from "./infoModal";
import { SendFromWallet, upgradeCompleteMessage } from "./sendFromWallet";
import { provider, upgradeOldContract } from "@/services";

// A Starknet address or private key: "0x" and up to 64 hex characters (leading zeros may be left out).
// Surrounding spaces from copy-pasting are removed before checking.
const starknetHexValue = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{1,64}$/, "Must be 0x followed by up to 64 hex characters");

const formSchema = z.object({
  address: starknetHexValue,
  privateKey: starknetHexValue,
});

const UpgradeForm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>(["Ready to upgrade accounts..."]);
  const logBoxRef = useRef<HTMLDivElement>(null);

  // The page is prerendered, so the form exists before React handles its submit event. A native
  // submit at that point would send the fields as a GET request, putting the private key in the URL.
  // The submit button stays disabled until hydration (which also blocks submitting with Enter), and
  // the inputs carry no name attribute, so a native submit has nothing to send.
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);

  // A prepared call that another account has to send (the meta-transaction or outside-execution step).
  const [pendingStep, setPendingStep] = useState<{
    call: Call;
    accountAddress: string;
    id: number;
    isConfirmed: boolean;
  } | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  // The form is locked while an upgrade runs and while a step waits to be sent from another account,
  // so the only action available is the one that moves the upgrade forward.
  const isStepPending = pendingStep !== null && !pendingStep.isConfirmed;
  const isFormLocked = isUpgrading || isStepPending;

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  // Logger implementation that follows ILogger interface
  const logger = {
    log: (...args: any[]) => {
      const message = args.join(" ");
      setLogs((prev) => [...prev, message]);
      console.log(...args);
    },
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      address: "",
      privateKey: "",
    },
  });

  // The step the page sends itself is always the last one, so its confirmation completes the upgrade.
  const reportFinalStep = async (transactionHash: string) => {
    try {
      const receipt = await provider.waitForTransaction(transactionHash);
      if (receipt.isSuccess()) {
        logger.log(`Transaction confirmed: ${transactionHash}`);
        toast.success(<p className="text-sm">{upgradeCompleteMessage}</p>, { duration: Infinity });
      } else {
        logger.log(`Transaction ${transactionHash} did not succeed: ${JSON.stringify(receipt.value)}`);
        toast.error(<p className="text-sm">Something went wrong. Please share the logs below with us.</p>, {
          duration: Infinity,
        });
      }
    } catch (error) {
      logger.log(`Waiting for transaction ${transactionHash} failed: ${error}`);
    }
  };

  const upgradeButtonSubmit = async (values: z.infer<typeof formSchema>) => {
    toast.dismiss();
    setLogs(["Starting upgrade process..."]);
    setPendingStep(null);
    setIsUpgrading(true);

    const upgrade = upgradeOldContract(logger, values.address, values.privateKey);
    // Stay locked until a transaction the page sent itself is confirmed, so it cannot be sent twice.
    upgrade.then(
      (result) => {
        if (typeof result === "string") reportFinalStep(result).finally(() => setIsUpgrading(false));
        else setIsUpgrading(false);
      },
      () => setIsUpgrading(false),
    );
    toast.promise(
      upgrade,
      {
        loading: `Upgrading account: ${values.address.slice(0, 5) + "..." + values.address.slice(-4)}`,
        success: (transactionHashOrCall) => {
          if (transactionHashOrCall === null) {
            return <p className="text-sm">Account is already at the latest version</p>;
          }
          if (typeof transactionHashOrCall === "string") {
            const transactionHash = transactionHashOrCall;
            return (
              <a href={`https://voyager.online/tx/${transactionHash}`} target="_blank" rel="noopener noreferrer">
                Transaction sent. Click here to view the transaction.
              </a>
            );
          } else {
            setPendingStep({
              call: transactionHashOrCall,
              accountAddress: values.address,
              id: Date.now(),
              isConfirmed: false,
            });
            return <p className="text-sm">Next: use another account to upgrade, below.</p>;
          }
        },
        error: (err) => {
          logger.log(err);
          return <p className="text-sm">{err.message}</p>;
        },
      },
      { duration: Infinity },
    );
  };

  return (
    <div className="flex-col w-full max-w-5xl px-5">
      <Toaster position="bottom-right" reverseOrder={false} />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(upgradeButtonSubmit)}
          className="font-barlow border border-[#FF875B] p-5 rounded-lg shadow-lg bg-white"
        >
          <div>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg font-medium">Starknet Address</FormLabel>
                  <FormControl>
                    <Input placeholder="account address" {...field} name={undefined} disabled={isFormLocked} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="privateKey"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <div className="flex items-center">
                    <FormLabel className="text-lg font-medium mr-2">Private Key</FormLabel>
                    <button
                      type="button"
                      onClick={() => setIsOpen(true)}
                      className="mt-1"
                      aria-label="About the private key"
                    >
                      <svg
                        width="1em"
                        height="1em"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <circle cx="12" cy="12" r="9.5" />
                        <path d="M12 11v6" strokeLinecap="round" />
                        <circle cx="12" cy="7.75" r="0.75" fill="currentColor" stroke="none" />
                      </svg>
                    </button>
                  </div>
                  <FormControl>
                    <Input placeholder="private key" {...field} name={undefined} disabled={isFormLocked} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex justify-center">
            <Button type="submit" className="mt-4" disabled={!isHydrated || isFormLocked}>
              Upgrade Account
            </Button>
          </div>
          {isStepPending && (
            <p className="text-sm text-gray-600 text-center mt-2">Finish the step below to continue.</p>
          )}
        </form>
      </Form>

      {pendingStep && (
        <SendFromWallet
          key={pendingStep.id}
          preparedCall={pendingStep.call}
          accountAddress={pendingStep.accountAddress}
          onConfirmed={() => setPendingStep((step) => (step ? { ...step, isConfirmed: true } : step))}
          onCancel={() => setPendingStep(null)}
          logger={logger}
        />
      )}

      {/* Log Box */}
      <div className="font-barlow border border-[#FF875B] p-5 rounded-lg shadow-lg bg-white mt-5">
        <h3 className="text-lg font-medium mb-3">Logs</h3>
        <div ref={logBoxRef} className="h-60 overflow-y-auto bg-gray-50 border rounded p-3 text-sm font-mono">
          {logs.map((log, index) => (
            <div key={index} className="text-gray-600 mb-1">
              {log}
            </div>
          ))}
        </div>
      </div>

      <InfoModal isOpen={isOpen} setIsOpen={setIsOpen} />
    </div>
  );
};

export default UpgradeForm;
