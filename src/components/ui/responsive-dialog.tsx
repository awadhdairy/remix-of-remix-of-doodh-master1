import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function ResponsiveDialog({ open, onOpenChange, children }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children}
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}

interface ResponsiveDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ResponsiveDialogContent({ children, className, ...props }: ResponsiveDialogContentProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerContent className={cn("max-h-[85vh] pb-safe", className)} {...props}>
        <div className="overflow-y-auto flex-1 px-4">
          {children}
        </div>
      </DrawerContent>
    );
  }

  return (
    <DialogContent className={cn("max-h-[90vh] overflow-hidden flex flex-col", className)} {...props}>
      {children}
    </DialogContent>
  );
}

interface ResponsiveDialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ResponsiveDialogHeader({ children, className, ...props }: ResponsiveDialogHeaderProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerHeader className={cn("text-left", className)} {...props}>
        {children}
      </DrawerHeader>
    );
  }

  return (
    <DialogHeader className={className} {...props}>
      {children}
    </DialogHeader>
  );
}

interface ResponsiveDialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export function ResponsiveDialogTitle({ children, className, ...props }: ResponsiveDialogTitleProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerTitle className={className} {...props}>
        {children}
      </DrawerTitle>
    );
  }

  return (
    <DialogTitle className={className} {...props}>
      {children}
    </DialogTitle>
  );
}

interface ResponsiveDialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export function ResponsiveDialogDescription({ children, className, ...props }: ResponsiveDialogDescriptionProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerDescription className={className} {...props}>
        {children}
      </DrawerDescription>
    );
  }

  return (
    <DialogDescription className={className} {...props}>
      {children}
    </DialogDescription>
  );
}

interface ResponsiveDialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ResponsiveDialogFooter({ children, className, ...props }: ResponsiveDialogFooterProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerFooter className={cn("pb-safe", className)} {...props}>
        {children}
      </DrawerFooter>
    );
  }

  return (
    <DialogFooter className={className} {...props}>
      {children}
    </DialogFooter>
  );
}

interface ResponsiveDialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  asChild?: boolean;
}

export function ResponsiveDialogClose({ children, asChild, ...props }: ResponsiveDialogCloseProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerClose asChild={asChild} {...props}>
        {children}
      </DrawerClose>
    );
  }

  return (
    <DialogClose asChild={asChild} {...props}>
      {children}
    </DialogClose>
  );
}
