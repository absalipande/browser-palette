import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";
import { cn } from "../../lib/cn";

const Dialog = DialogPrimitive.Root;
const DialogTitle = DialogPrimitive.Title;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay className={cn("bp-dialog-overlay", className)} ref={ref} {...props} />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <>
    <DialogOverlay />
    <DialogPrimitive.Content className={cn("bp-dialog-content", className)} ref={ref} {...props} />
  </>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export { Dialog, DialogContent, DialogTitle };
