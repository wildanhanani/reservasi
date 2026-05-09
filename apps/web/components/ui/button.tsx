import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-slate-950 text-white shadow-sm hover:-translate-y-0.5 hover:bg-indigo-600 hover:shadow-lg",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
        outline: "border border-slate-200 bg-white/90 text-slate-800 shadow-sm hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50",
        ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
        destructive: "bg-red-600 text-white shadow-sm hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-lg"
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3",
        lg: "h-11 px-6",
        icon: "h-10 w-10 px-0"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
