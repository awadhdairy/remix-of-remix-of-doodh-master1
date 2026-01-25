import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { 
  Plus, 
  Droplets, 
  Truck, 
  Receipt, 
  Beef, 
  Users,
  Zap,
  Milk,
  PackagePlus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { QuickAddOnOrderDialog } from "@/components/customers/QuickAddOnOrderDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Customer {
  id: string;
  name: string;
  area: string | null;
}

const quickActions = [
  {
    title: "Record Milk",
    icon: Droplets,
    href: "/production?action=add",
    color: "text-info",
    bgColor: "bg-info/10 hover:bg-info/20",
  },
  {
    title: "Addon Delivery",
    icon: PackagePlus,
    href: null, // Will open dialog instead
    color: "text-warning",
    bgColor: "bg-warning/10 hover:bg-warning/20",
    isAddonAction: true,
  },
  {
    title: "Create Invoice",
    icon: Receipt,
    href: "/billing?action=add",
    color: "text-success",
    bgColor: "bg-success/10 hover:bg-success/20",
  },
  {
    title: "Add Cattle",
    icon: Beef,
    href: "/cattle?action=add",
    color: "text-primary",
    bgColor: "bg-primary/10 hover:bg-primary/20",
  },
  {
    title: "New Customer",
    icon: Users,
    href: "/customers?action=add",
    color: "text-accent",
    bgColor: "bg-accent/10 hover:bg-accent/20",
  },
  {
    title: "Procurement",
    icon: Milk,
    href: "/milk-procurement?action=add",
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
  },
};

export function QuickActionsCard() {
  const [customerSelectOpen, setCustomerSelectOpen] = useState(false);
  const [addonDialogOpen, setAddonDialogOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customerSelectOpen) {
      fetchCustomers();
    }
  }, [customerSelectOpen]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, area")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddonClick = () => {
    setCustomerSelectOpen(true);
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setSelectedCustomer(customer);
      setCustomerSelectOpen(false);
      setAddonDialogOpen(true);
    }
  };

  const handleAddonSuccess = () => {
    setAddonDialogOpen(false);
    setSelectedCustomer(null);
  };

  const renderActionButton = (action: typeof quickActions[0]) => {
    if (action.isAddonAction) {
      return (
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleAddonClick}
        >
          <Button
            variant="ghost"
            className={cn(
              "h-auto w-full flex-col gap-2 p-4 transition-colors duration-200",
              action.bgColor
            )}
          >
            <action.icon className={cn("h-6 w-6", action.color)} />
            <span className="text-xs font-medium text-foreground">{action.title}</span>
          </Button>
        </motion.div>
      );
    }

    return (
      <Link to={action.href!}>
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Button
            variant="ghost"
            className={cn(
              "h-auto w-full flex-col gap-2 p-4 transition-colors duration-200",
              action.bgColor
            )}
          >
            <action.icon className={cn("h-6 w-6", action.color)} />
            <span className="text-xs font-medium text-foreground">{action.title}</span>
          </Button>
        </motion.div>
      </Link>
    );
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <Zap className="h-5 w-5 text-warning" />
              </motion.div>
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <motion.div 
              className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {quickActions.map((action) => (
                <motion.div key={action.title} variants={itemVariants}>
                  {renderActionButton(action)}
                </motion.div>
              ))}
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Customer Selection Dialog */}
      <Dialog open={customerSelectOpen} onOpenChange={setCustomerSelectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-warning" />
              Addon Delivery
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Customer</Label>
              <Select onValueChange={handleCustomerSelect} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "Loading customers..." : "Choose a customer"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      <div className="flex items-center gap-2">
                        <span>{customer.name}</span>
                        {customer.area && (
                          <span className="text-xs text-muted-foreground">({customer.area})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Create an addon delivery for extra products requested by a customer. This will be properly recorded in deliveries, ledger, and billing.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Addon Order Dialog */}
      {selectedCustomer && (
        <QuickAddOnOrderDialog
          open={addonDialogOpen}
          onOpenChange={setAddonDialogOpen}
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.name}
          onSuccess={handleAddonSuccess}
        />
      )}
    </>
  );
}
