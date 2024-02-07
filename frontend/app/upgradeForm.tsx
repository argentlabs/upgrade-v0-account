"use client";

import { useState } from "react";
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      address: "",
      privateKey: "",
    },
  });

  const upgradeButtonSubmit = async (values: z.infer<typeof formSchema>) => {
    toast.dismiss();
    toast.promise(
      upgradeOldContract(values.address, values.privateKey),
      {
        loading: `Upgrading account: ${values.address.slice(0, 5) + "..." + values.address.slice(-4)}`,
        success: (transactionHash) => (
          <a href={`https://starkscan.co/tx/${transactionHash}`} target="_blank" rel="noopener noreferrer">
            Transaction subitted! Click here to view the transaction.
          </a>
        ),
        error: (err) => <p className="text-sm">${err.message}</p>,
      },
      { duration: Infinity },
    );
  };

  return (
    <div className="flex-col w-full max-w-2xl px-5">
      <h1 className="font-barlow font-medium text-xl mb-3">Upgrade your deprecated account to the latest one</h1>
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
        </form>
      </Form>
      <InfoModal isOpen={isOpen} setIsOpen={setIsOpen} />
    </div>
  );
};

export default UpgradeForm;
