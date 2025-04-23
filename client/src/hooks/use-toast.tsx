import { Toast, ToastActionElement, ToastProps } from "@/components/ui/toast";
import {
  toast,
  useToast as useToastPrimitive,
} from "@/components/ui/use-toast";

type ToastOptions = Omit<ToastProps, "children"> & {
  description?: React.ReactNode;
  action?: ToastActionElement;
};

export function useToast() {
  const hookToast = useToastPrimitive();

  return {
    ...hookToast,
    toast: (options: ToastOptions) => {
      toast({
        ...options,
      });
    },
    success: (options: Omit<ToastOptions, "variant">) => {
      toast({
        ...options,
        variant: "default",
        className: "bg-green-500 text-white border-none",
      });
    },
    error: (options: Omit<ToastOptions, "variant">) => {
      toast({
        ...options,
        variant: "destructive",
      });
    },
    warning: (options: Omit<ToastOptions, "variant">) => {
      toast({
        ...options,
        variant: "default",
        className: "bg-yellow-500 text-white border-none",
      });
    },
    info: (options: Omit<ToastOptions, "variant">) => {
      toast({
        ...options,
        variant: "default",
        className: "bg-blue-500 text-white border-none",
      });
    },
  };
}