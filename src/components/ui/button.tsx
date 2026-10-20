import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-elevated disabled:text-muted-foreground disabled:shadow-none [&_svg]:size-4 shrink-0",
  { variants: { variant: {
    default: "border border-primary-border bg-primary text-primary-foreground hover:bg-primary-hover disabled:hover:bg-surface-elevated",
    outline: "border border-border-control bg-transparent text-foreground hover:bg-muted disabled:hover:bg-surface-elevated",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  } }, defaultVariants: { variant: "default" } },
);
export function Button({ className, variant, asChild = false, ...props }:
  React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return <Component data-slot="button" className={cn(buttonVariants({ variant, className }))} {...props} />;
}
