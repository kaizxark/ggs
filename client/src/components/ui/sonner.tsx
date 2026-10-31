import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { MAX_VISIBLE } from "@/lib/toast";

/**
 * Toast host.
 *
 * Polished toast host calibrated with Apple HIG frosted dark surfaces,
 * specular inner rim lighting, and elegant custom status iconography.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "dark" } = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster"
      position="bottom-right"
      duration={4200}
      visibleToasts={MAX_VISIBLE}
      closeButton
      icons={{
        success: <CheckCircle2 className="erp-toast-icon" size={16} strokeWidth={2.4} />,
        info: <Info className="erp-toast-icon" size={16} strokeWidth={2.4} />,
        warning: <AlertTriangle className="erp-toast-icon" size={16} strokeWidth={2.4} />,
        error: <AlertCircle className="erp-toast-icon" size={16} strokeWidth={2.4} />,
        loading: <Loader2 className="erp-toast-icon animate-spin" size={16} strokeWidth={2.4} />,
      }}
      toastOptions={{
        classNames: {
          toast: "erp-toast",
          title: "erp-toast-title",
          description: "erp-toast-description",
          actionButton: "erp-toast-action",
          cancelButton: "erp-toast-cancel",
          closeButton: "erp-toast-close",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
