import * as React from "react";

import { cn } from "@/lib/utils";

export const buttonClassName =
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-[#FF875B] text-primary-foreground hover:bg-[#FF875Bc2] h-10 px-4 py-2";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, ...props }, ref) => {
  return <button className={cn(buttonClassName, className)} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button };
