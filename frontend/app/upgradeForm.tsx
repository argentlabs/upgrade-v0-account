"use client";

import { useState, useEffect, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CiCircleInfo } from "react-icons/ci";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InfoModal } from "./infoModal";
import { upgradeOldContract } from "@/services";

const formSchema = z.object({
  address: z.string().startsWith("0x").min(50).max(80),
  privateKey: z.string().startsWith("0x").min(50).max(80),
});

const UpgradeForm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>(["Ready to upgrade accounts..."]);
  const logBoxRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  // Logger implementation that follows ILogger interface
  const logger = {
    log: (...args: any[]) => {
      const timestamp = new Date().toLocaleTimeString();
      const message = `[${timestamp}] ${args.join(" ")}`;
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

  const upgradeButtonSubmit = async (values: z.infer<typeof formSchema>) => {
    toast.dismiss();
    setLogs(["Starting upgrade process..."]);

    toast.promise(
      upgradeOldContract(logger, values.address, values.privateKey),
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
                Transaction successful! Click here to view the transaction.
              </a>
            );
          } else {
            return <></>;
          }
        },
        error: (err) => {
          console.error(err);
          return <p className="text-sm">${err.message}</p>;
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
                  <FormLabel className="text-lg font-medium">Account Address</FormLabel>
                  <FormControl>
                    <Input placeholder="account address" {...field} />
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
                    <button type="button" onClick={() => setIsOpen(true)} className="mt-1">
                      <CiCircleInfo />
                    </button>
                  </div>
                  <FormControl>
                    <Input placeholder="private key" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex justify-center">
            <Button type="submit" className="mt-4">
              Upgrade Account
            </Button>
          </div>
          <div className="flex justify-center"></div>
        </form>
      </Form>

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
