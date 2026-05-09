import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-10 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-950 shadow-sm ring-offset-background transition placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
