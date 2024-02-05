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
  address: z.string().startsWith("0x").length(66),
  privateKey: z.string().startsWith("0x").length(66),
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
    toast.promise(upgradeOldContract(values.address, values.privateKey), {
      loading: `upgrading old account: ${values.address}`,
      success: (transactionHash) => (
        <a href={`https://starkscan.co/tx/${transactionHash}`} target="_blank" rel="noopener noreferrer">
          Transaction hash: {transactionHash}
        </a>
      ),
      error: (err) => <b>${err.message}</b>,
    });
  };

  return (
    <div className="flex-col w-full max-w-2xl ml-5 mr-5 ">
      <h1 className="font-barlow font-medium text-xl mb-3">Please fill in the form below to upgrade your account:</h1>
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
                  <FormLabel className="text-lg font-medium">Address</FormLabel>
                  <FormControl>
                    <Input placeholder="wallet address" {...field} />
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
              Uprgade Account
            </Button>
          </div>
        </form>
      </Form>
      <InfoModal isOpen={isOpen} setIsOpen={setIsOpen} />
    </div>
  );
};

export default UpgradeForm;
