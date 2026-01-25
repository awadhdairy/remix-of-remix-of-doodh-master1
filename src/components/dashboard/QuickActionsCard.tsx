import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { 
  Droplets, 
  Receipt, 
  Beef, 
  Users,
  Zap,
  Milk,
  PackagePlus,
  Search,
  Loader2,
  MapPin
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useCapacitor } from "@/hooks/useCapacitor";

interface Customer {
  id: string;
  name: string;
  area: string | null;
  phone: string | null;
}

interface QuickAction {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string | null;
  color: string;
  bgColor: string;
  isAddonAction?: boolean;
}

const quickActions: QuickAction[] = [
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
    href: null,
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
  const { hapticImpact, hapticSelection } = useCapacitor();
  const [customerSelectOpen, setCustomerSelectOpen] = useState(false);
  const [addonDialogOpen, setAddonDialogOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (customerSelectOpen) {
      fetchCustomers();
      setSearchQuery("");
    }
  }, [customerSelectOpen]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, area, phone")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.area?.toLowerCase().includes(query) ||
        c.phone?.includes(query)
    );
  }, [customers, searchQuery]);

  const handleAddonClick = () => {
    hapticImpact("light");
    setCustomerSelectOpen(true);
  };

  const handleCustomerSelect = (customer: Customer) => {
    hapticSelection();
    setSelectedCustomer(customer);
    setCustomerSelectOpen(false);
    // Small delay to ensure smooth dialog transition
    setTimeout(() => {
      setAddonDialogOpen(true);
    }, 100);
  };

  const handleActionClick = () => {
    hapticImpact("light");
  };

  const handleAddonDialogClose = (open: boolean) => {
    setAddonDialogOpen(open);
    if (!open) {
      setSelectedCustomer(null);
    }
  };

  const handleAddonSuccess = () => {
    setAddonDialogOpen(false);
    setSelectedCustomer(null);
    toast.success("Addon delivery created successfully!");
  };

  const renderActionButton = (action: QuickAction) => {
    if (action.isAddonAction) {
      return (
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleAddonClick}
          className="cursor-pointer"
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
      <Link to={action.href!} onClick={handleActionClick}>
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
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-warning" />
              Select Customer for Addon Delivery
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, area, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            {/* Customer List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No customers found" : "No active customers"}
              </div>
            ) : (
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-2 pb-4">
                  {filteredCustomers.map((customer) => (
                    <motion.div
                      key={customer.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <Button
                        variant="outline"
                        className="w-full justify-start h-auto py-3 px-4"
                        onClick={() => handleCustomerSelect(customer)}
                      >
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-medium">{customer.name}</span>
                          {customer.area && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {customer.area}
                            </span>
                          )}
                        </div>
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <p className="text-xs text-muted-foreground text-center pt-2 border-t">
              Select a customer to create an addon delivery
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Addon Order Dialog */}
      {selectedCustomer && (
        <QuickAddOnOrderDialog
          open={addonDialogOpen}
          onOpenChange={handleAddonDialogClose}
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.name}
          onSuccess={handleAddonSuccess}
        />
      )}
    </>
  );
}
