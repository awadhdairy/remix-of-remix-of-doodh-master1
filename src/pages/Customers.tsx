import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { invalidateCustomerRelated, invalidateBillingRelated } from "@/lib/query-invalidation";
import { useTelegramNotify } from "@/hooks/useTelegramNotify";
import { format } from "date-fns";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Users, Edit, Trash2, Phone, MapPin, Loader2, Palmtree, BookOpen, Eye, Route, IndianRupee } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { VacationManager } from "@/components/customers/VacationManager";
import { CustomerLedger } from "@/components/customers/CustomerLedger";
import { CustomerAccountApprovals } from "@/components/customers/CustomerAccountApprovals";
import { CustomerDetailDialog } from "@/components/customers/CustomerDetailDialog";
import {
  CustomerSubscriptionSelector,
  CustomerSubscriptionData,
  defaultSubscriptionData,
} from "@/components/customers/CustomerSubscriptionSelector";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  area: string | null;
  subscription_type: string;
  billing_cycle: string;
  credit_balance: number;
  advance_balance: number;
  is_active: boolean;
  created_at: string;
  notes: string | null;
  route_id: string | null;
  routes?: { name: string; area: string | null } | null;
}

interface RouteOption {
  id: string;
  name: string;
  area: string | null;
}

const emptyFormData = {
  name: "",
  phone: "",
  email: "",
  address: "",
  area: "",
  subscription_type: "daily",
  billing_cycle: "monthly",
  notes: "",
  route_id: "",
};

interface CustomerProduct {
  customer_id: string;
  product_name: string;
  quantity: number;
}

interface UnpaidInvoice {
  id: string;
  invoice_number: string;
  final_amount: number;
  paid_amount: number;
  payment_status: string;
}

export default function CustomersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerProducts, setCustomerProducts] = useState<Record<string, CustomerProduct[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false);
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [subscriptionData, setSubscriptionData] = useState<CustomerSubscriptionData>(defaultSubscriptionData);
  const [dialogTab, setDialogTab] = useState<"details" | "subscription">("details");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const { notifyPaymentReceived, notifyLargeTransaction } = useTelegramNotify();

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("general");
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);

  useEffect(() => {
    fetchCustomers();
    fetchRoutes();
    if (searchParams.get("action") === "add") {
      setDialogOpen(true);
      setSearchParams({});
    }
  }, [searchParams]);

  const fetchCustomers = async () => {
    setLoading(true);
    
    // Fetch customers and their subscribed products in parallel
    const [customersRes, productsRes] = await Promise.all([
      supabase.from("customers").select("*, routes(name, area)").order("name"),
      supabase
        .from("customer_products")
        .select(`
          customer_id,
          quantity,
          product:product_id (name)
        `)
        .eq("is_active", true)
    ]);

    if (customersRes.error) {
      toast({
        title: "Error fetching customers",
        description: customersRes.error.message,
        variant: "destructive",
      });
    } else {
      setCustomers(customersRes.data || []);
    }

    // Group products by customer_id
    if (productsRes.data) {
      const grouped: Record<string, CustomerProduct[]> = {};
      productsRes.data.forEach((p: any) => {
        if (!grouped[p.customer_id]) {
          grouped[p.customer_id] = [];
        }
        grouped[p.customer_id].push({
          customer_id: p.customer_id,
          product_name: p.product?.name || "Unknown",
          quantity: p.quantity,
        });
      });
      setCustomerProducts(grouped);
    }

    setLoading(false);
  };

  const fetchRoutes = async () => {
    const { data } = await supabase
      .from("routes")
      .select("id, name, area")
      .eq("is_active", true)
      .order("name");
    if (data) setRoutes(data);
  };

  // Auto-suggest route based on area match
  const suggestRouteForArea = (area: string): string | null => {
    if (!area || routes.length === 0) return null;
    const areaLower = area.toLowerCase();
    const match = routes.find(r => 
      r.area?.toLowerCase().includes(areaLower) ||
      areaLower.includes(r.area?.toLowerCase() || '')
    );
    return match?.id || null;
  };

  const handleOpenDialog = async (customer?: Customer) => {
    if (customer) {
      setSelectedCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone || "",
        email: customer.email || "",
        address: customer.address || "",
        area: customer.area || "",
        subscription_type: customer.subscription_type,
        billing_cycle: customer.billing_cycle,
        notes: "",
        route_id: customer.route_id || "",
      });
      
      // Load existing subscription products for this customer
      const { data: existingProducts } = await supabase
        .from("customer_products")
        .select(`
          product_id,
          quantity,
          custom_price,
          is_active,
          product:product_id (name, unit)
        `)
        .eq("customer_id", customer.id)
        .eq("is_active", true);

      if (existingProducts && existingProducts.length > 0) {
        // Parse delivery days from notes if available
        let globalDeliveryDays = defaultSubscriptionData.delivery_days;
        let autoDeliver = true;
        let productSchedules: Record<string, { frequency: string; delivery_days: any }> = {};
        
        // Try to parse schedule from notes (stored as JSON)
        const notesMatch = customer.notes?.match(/Schedule:\s*(\{[\s\S]*\})/);
        if (notesMatch) {
          try {
            const schedule = JSON.parse(notesMatch[1]);
            if (schedule.delivery_days) globalDeliveryDays = schedule.delivery_days;
            if (typeof schedule.auto_deliver === "boolean") autoDeliver = schedule.auto_deliver;
            if (schedule.product_schedules) productSchedules = schedule.product_schedules;
          } catch {}
        }

        const products = existingProducts.map((p: any) => ({
          product_id: p.product_id,
          product_name: p.product?.name || "Unknown",
          quantity: p.quantity,
          custom_price: p.custom_price,
          unit: p.product?.unit || "unit",
          frequency: (productSchedules[p.product_id]?.frequency || customer.subscription_type || "daily") as "daily" | "alternate" | "weekly" | "custom",
          delivery_days: productSchedules[p.product_id]?.delivery_days || { ...globalDeliveryDays },
        }));

        setSubscriptionData({
          products,
          frequency: customer.subscription_type as any || "daily",
          delivery_days: globalDeliveryDays,
          auto_deliver: autoDeliver,
        });
      } else {
        setSubscriptionData({
          ...defaultSubscriptionData,
          frequency: customer.subscription_type as any || "daily",
        });
      }
      
      setDialogTab("details");
    } else {
      setSelectedCustomer(null);
      setFormData(emptyFormData);
      setSubscriptionData(defaultSubscriptionData);
      setDialogTab("details");
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    
    // Map UI frequency to database subscription_type
    const subscriptionTypeMap: Record<string, string> = {
      daily: "daily",
      alternate: "alternate",
      weekly: "weekly",
      custom: "custom",
    };

    // Build schedule metadata with per-product schedules
    const productSchedules: Record<string, { frequency: string; delivery_days: any }> = {};
    subscriptionData.products.forEach(p => {
      productSchedules[p.product_id] = {
        frequency: p.frequency,
        delivery_days: p.delivery_days,
      };
    });

    const scheduleMetadata = {
      delivery_days: subscriptionData.delivery_days,
      auto_deliver: subscriptionData.auto_deliver,
      product_schedules: productSchedules,
    };

    // Combine user notes with schedule metadata
    const notesWithSchedule = formData.notes 
      ? `${formData.notes}\n\n---\nSchedule: ${JSON.stringify(scheduleMetadata)}`
      : `Schedule: ${JSON.stringify(scheduleMetadata)}`;

    const payload = {
      name: formData.name,
      phone: formData.phone || null,
      email: formData.email || null,
      address: formData.address || null,
      area: formData.area || null,
      subscription_type: subscriptionTypeMap[subscriptionData.frequency] || formData.subscription_type,
      billing_cycle: formData.billing_cycle,
      notes: notesWithSchedule,
      route_id: formData.route_id || null,
    };

    if (selectedCustomer) {
      // Update existing customer
      const { error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", selectedCustomer.id);

      if (error) {
        setSaving(false);
        toast({
          title: "Error saving customer",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Update subscription products - delete existing and insert new
      // First, deactivate all existing subscriptions
      await supabase
        .from("customer_products")
        .update({ is_active: false })
        .eq("customer_id", selectedCustomer.id);

      // Then insert/update new subscriptions
      if (subscriptionData.products.length > 0) {
        for (const p of subscriptionData.products) {
          // Check if product already exists for this customer
          const { data: existing } = await supabase
            .from("customer_products")
            .select("id")
            .eq("customer_id", selectedCustomer.id)
            .eq("product_id", p.product_id)
            .single();

          if (existing) {
            // Update existing record
            await supabase
              .from("customer_products")
              .update({
                quantity: p.quantity,
                custom_price: p.custom_price,
                is_active: true,
              })
              .eq("id", existing.id);
          } else {
            // Insert new record
            await supabase.from("customer_products").insert({
              customer_id: selectedCustomer.id,
              product_id: p.product_id,
              quantity: p.quantity,
              custom_price: p.custom_price,
              is_active: true,
            });
          }
        }
      }

      setSaving(false);
      toast({
        title: "Customer updated",
        description: `${formData.name} and subscriptions have been saved successfully`,
      });
      setDialogOpen(false);
      invalidateCustomerRelated(queryClient);
      fetchCustomers();
    } else {
      // Create new customer with subscription products
      const { data: newCustomer, error } = await supabase
        .from("customers")
        .insert(payload)
        .select("id")
        .single();

      if (error || !newCustomer) {
        setSaving(false);
        toast({
          title: "Error saving customer",
          description: error?.message || "Failed to create customer",
          variant: "destructive",
        });
        return;
      }

      // Add subscription products if any
      if (subscriptionData.products.length > 0) {
        const productsToInsert = subscriptionData.products.map((p) => ({
          customer_id: newCustomer.id,
          product_id: p.product_id,
          quantity: p.quantity,
          custom_price: p.custom_price,
          is_active: true,
        }));

        const { error: productError } = await supabase
          .from("customer_products")
          .insert(productsToInsert);

        if (productError) {
          console.error("Error adding subscription products:", productError);
          // Don't fail the whole operation, just log it
        }
      }

      // Add customer to route_stops if route is assigned
      if (formData.route_id) {
        try {
          // Get next stop order for this route
          const { data: existingStops } = await supabase
            .from("route_stops")
            .select("stop_order")
            .eq("route_id", formData.route_id)
            .order("stop_order", { ascending: false })
            .limit(1);
          
          const nextOrder = (existingStops?.[0]?.stop_order || 0) + 1;
          
          await supabase.from("route_stops").insert({
            route_id: formData.route_id,
            customer_id: newCustomer.id,
            stop_order: nextOrder,
          });
        } catch (routeStopError) {
          console.warn("Could not add to route_stops:", routeStopError);
          // Don't fail the whole operation
        }
      }

      // Store delivery schedule in customer notes as JSON metadata
      // This can be used by the auto-delivery scheduler
      const scheduleMetadata = {
        delivery_days: subscriptionData.delivery_days,
        auto_deliver: subscriptionData.auto_deliver,
      };

      await supabase
        .from("customers")
        .update({ 
          notes: formData.notes 
            ? `${formData.notes}\n\n---\nSchedule: ${JSON.stringify(scheduleMetadata)}`
            : `Schedule: ${JSON.stringify(scheduleMetadata)}`
        })
        .eq("id", newCustomer.id);

      setSaving(false);
      toast({
        title: "Customer added",
        description: `${formData.name} has been created with ${subscriptionData.products.length} subscription product(s)`,
      });
      setDialogOpen(false);
      invalidateCustomerRelated(queryClient);
      fetchCustomers();
    }
  };

  const handleDelete = async () => {
    if (!selectedCustomer) return;

    const { error } = await supabase.from("customers").delete().eq("id", selectedCustomer.id);

    if (error) {
      toast({
        title: "Error deleting customer",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Customer deleted",
        description: `${selectedCustomer.name} has been removed`,
      });
      setDeleteDialogOpen(false);
      setSelectedCustomer(null);
      invalidateCustomerRelated(queryClient);
      fetchCustomers();
    }
  };

  // === Payment Dialog Logic ===
  const openPaymentDialog = async (customer: Customer) => {
    setPaymentCustomer(customer);
    setPaymentAmount("");
    setPaymentMode("cash");
    setPaymentNotes("");
    setSelectedInvoiceId("general");
    setPaymentDialogOpen(true);
    
    // Fetch unpaid invoices for this customer
    setLoadingInvoices(true);
    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, final_amount, paid_amount, payment_status")
      .eq("customer_id", customer.id)
      .neq("payment_status", "paid")
      .order("created_at", { ascending: false });
    setUnpaidInvoices(data || []);
    setLoadingInvoices(false);
  };

  const handleRecordPayment = async () => {
    if (!paymentCustomer || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (amount <= 0) return;
    
    setRecordingPayment(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const isInvoicePayment = selectedInvoiceId !== "general";
      
      // 1. If invoice-linked, update invoice
      if (isInvoicePayment) {
        const invoice = unpaidInvoices.find(i => i.id === selectedInvoiceId);
        if (invoice) {
          const invoiceRemaining = Number(invoice.final_amount) - Number(invoice.paid_amount);
          const cappedAmount = Math.min(amount, invoiceRemaining);
          const newPaidAmount = Number(invoice.paid_amount) + cappedAmount;
          const remaining = Number(invoice.final_amount) - newPaidAmount;
          let newStatus: "paid" | "partial" | "pending" = "partial";
          if (remaining <= 0) newStatus = "paid";
          else if (newPaidAmount === 0) newStatus = "pending";
          
          await supabase
            .from("invoices")
            .update({
              paid_amount: newPaidAmount,
              payment_status: newStatus,
              ...(newStatus === "paid" ? { payment_date: today } : {}),
            })
            .eq("id", invoice.id);
        }
      }
      
      // 2. Insert payment record
      await supabase.from("payments").insert({
        customer_id: paymentCustomer.id,
        amount,
        payment_mode: paymentMode,
        payment_date: today,
        invoice_id: isInvoicePayment ? selectedInvoiceId : null,
        notes: paymentNotes || null,
      });
      
      // 3. Atomic ledger entry with running balance (prevents race conditions)
      const invoiceRef = isInvoicePayment 
        ? unpaidInvoices.find(i => i.id === selectedInvoiceId)?.invoice_number 
        : null;
      
      await supabase.rpc("insert_ledger_with_balance", {
        _customer_id: paymentCustomer.id,
        _transaction_date: today,
        _transaction_type: "payment",
        _description: invoiceRef ? `Payment for ${invoiceRef}` : "General Payment",
        _debit_amount: 0,
        _credit_amount: amount,
        _reference_id: isInvoicePayment ? selectedInvoiceId : null,
      });
      
      // 4. Invalidate and refresh
      invalidateBillingRelated(queryClient);
      invalidateCustomerRelated(queryClient);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      
      // 5. Telegram notifications
      notifyPaymentReceived({
        amount,
        customer_name: paymentCustomer.name,
        payment_mode: paymentMode,
        reference: invoiceRef || undefined,
      });
      if (amount >= 10000) {
        notifyLargeTransaction({
          amount,
          customer_name: paymentCustomer.name,
          payment_mode: paymentMode,
          reference: invoiceRef || undefined,
        });
      }
      
      toast({
        title: "Payment recorded",
        description: `₹${amount.toLocaleString("en-IN")} payment recorded for ${paymentCustomer.name}`,
      });
      
      setPaymentDialogOpen(false);
      fetchCustomers();
    } catch (error: any) {
      toast({
        title: "Error recording payment",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRecordingPayment(false);
    }
  };

  // Active customers only; Math.max(0,...) prevents negative credits from reducing "total due"
  const totalDue = customers.filter(c => c.is_active).reduce((sum, c) => sum + Math.max(0, Number(c.credit_balance)), 0);
  const totalAdvance = customers.filter(c => c.is_active).reduce((sum, c) => sum + Math.max(0, Number(c.advance_balance)), 0);

  const handleOpenDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailDialogOpen(true);
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (item: Customer) => (
        <div 
          className="flex flex-col cursor-pointer group"
          onClick={() => handleOpenDetail(item)}
        >
          <span className="font-semibold flex items-center gap-1 text-primary group-hover:underline">
            {item.name}
            <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
          {item.area && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {item.area}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Contact",
      render: (item: Customer) => (
        <div 
          className="flex flex-col cursor-pointer group"
          onClick={() => handleOpenDetail(item)}
        >
          {item.phone && (
            <span className="flex items-center gap-1 text-sm text-primary group-hover:underline">
              <Phone className="h-3 w-3" /> {item.phone}
            </span>
          )}
          {item.email && (
            <span className="text-xs text-muted-foreground">{item.email}</span>
          )}
        </div>
      ),
    },
    {
      key: "subscribed_products",
      header: "Subscribed Products",
      render: (item: Customer) => {
        const products = customerProducts[item.id] || [];
        if (products.length === 0) {
          return <span className="text-muted-foreground text-xs">No subscription</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {products.slice(0, 3).map((p, idx) => (
              <span key={idx} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {p.product_name} × {p.quantity}
              </span>
            ))}
            {products.length > 3 && (
              <span className="text-xs text-muted-foreground">+{products.length - 3} more</span>
            )}
          </div>
        );
      },
    },
    {
      key: "subscription_type",
      header: "Frequency",
      render: (item: Customer) => (
        <span className="capitalize text-sm">{item.subscription_type}</span>
      ),
    },
    {
      key: "route",
      header: "Route",
      render: (item: Customer) => (
        <span className="text-sm">
          {item.routes?.name || (
            <span className="text-muted-foreground text-xs">No route</span>
          )}
        </span>
      ),
    },
    {
      key: "billing_cycle",
      header: "Billing",
      render: (item: Customer) => (
        <span className="capitalize text-sm">{item.billing_cycle}</span>
      ),
    },
    {
      key: "credit_balance",
      header: "Due",
      render: (item: Customer) => {
        const due = Number(item.credit_balance);
        if (due > 0) {
          return (
            <Badge variant="destructive" className="font-semibold">
              ₹{due.toLocaleString()}
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/20 font-medium">
            Paid Up
          </Badge>
        );
      },
    },
    {
      key: "advance_balance",
      header: "Advance",
      render: (item: Customer) => (
        <span className={item.advance_balance > 0 ? "text-success font-medium" : ""}>
          ₹{Number(item.advance_balance).toLocaleString()}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      render: (item: Customer) => (
        <StatusBadge status={item.is_active ? "active" : "inactive"} />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: Customer) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Vacation/Pause"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCustomer(item);
              setVacationDialogOpen(true);
            }}
          >
            <Palmtree className="h-4 w-4 text-primary" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Ledger"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCustomer(item);
              setLedgerDialogOpen(true);
            }}
          >
            <BookOpen className="h-4 w-4 text-info" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Record Payment"
            onClick={(e) => {
              e.stopPropagation();
              openPaymentDialog(item);
            }}
          >
            <IndianRupee className="h-4 w-4 text-success" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDialog(item);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCustomer(item);
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage your customer base"
        icon={Users}
        action={{
          label: "Add Customer",
          onClick: () => handleOpenDialog(),
        }}
      />

      {/* Pending Customer Approvals */}
      <CustomerAccountApprovals />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-animation">
        <Card className="group overflow-hidden hover-lift">
          <CardContent className="pt-6 relative">
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{customers.length}</div>
                <p className="text-sm text-muted-foreground font-medium">Total Customers</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-colored">
                <Users className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="group overflow-hidden hover-lift">
          <CardContent className="pt-6 relative">
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-success/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-success">
                  {customers.filter((c) => c.is_active).length}
                </div>
                <p className="text-sm text-muted-foreground font-medium">Active</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-success to-success/70 flex items-center justify-center shadow-md">
                <Users className="h-6 w-6 text-success-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="group overflow-hidden hover-lift">
          <CardContent className="pt-6 relative">
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-destructive/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-destructive">
                  ₹{totalDue.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground font-medium">Total Due</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-destructive to-destructive/70 flex items-center justify-center shadow-md">
                <span className="text-destructive-foreground font-bold">₹</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="group overflow-hidden hover-lift">
          <CardContent className="pt-6 relative">
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-info/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-info">
                  ₹{totalAdvance.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground font-medium">Total Advance</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-info to-info/70 flex items-center justify-center shadow-md">
                <span className="text-info-foreground font-bold">₹</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={customers}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search by name, phone, area..."
        emptyMessage="No customers found. Add your first customer."
      />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer ? "Edit Customer" : "Add New Customer"}
            </DialogTitle>
            <DialogDescription>
              {selectedCustomer
                ? "Update customer information"
                : "Enter details and set up subscription products"}
            </DialogDescription>
          </DialogHeader>

          {/* Show tabs only for new customer */}
          {!selectedCustomer ? (
            <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as typeof dialogTab)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">1. Customer Details</TabsTrigger>
                <TabsTrigger value="subscription" disabled={!formData.name}>
                  2. Subscription Products
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Customer name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="customer@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area">Area</Label>
                    <Input
                      id="area"
                      value={formData.area}
                      onChange={(e) =>
                        setFormData({ ...formData, area: e.target.value })
                      }
                      placeholder="e.g., Sector 15, Noida"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Full address"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_cycle">Billing Cycle</Label>
                  <Select
                    value={formData.billing_cycle}
                    onValueChange={(v) =>
                      setFormData({ ...formData, billing_cycle: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Any additional notes..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="route">Delivery Route</Label>
                  <Select
                    value={formData.route_id || "__none__"}
                    onValueChange={(v) => setFormData({ ...formData, route_id: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select route (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No route assigned</SelectItem>
                      {routes.map((route) => (
                        <SelectItem key={route.id} value={route.id}>
                          {route.name} {route.area && `(${route.area})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.area && !formData.route_id && suggestRouteForArea(formData.area) && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-primary"
                      onClick={() => {
                        const suggested = suggestRouteForArea(formData.area);
                        if (suggested) setFormData({ ...formData, route_id: suggested });
                      }}
                    >
                      💡 Suggest: {routes.find(r => r.id === suggestRouteForArea(formData.area))?.name}
                    </Button>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => setDialogTab("subscription")}
                    disabled={!formData.name}
                  >
                    Next: Select Products
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="subscription" className="mt-4">
                <CustomerSubscriptionSelector
                  value={subscriptionData}
                  onChange={setSubscriptionData}
                />

                <div className="flex justify-between gap-2 pt-4 mt-4 border-t">
                  <Button variant="outline" onClick={() => setDialogTab("details")}>
                    Back
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Customer
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            /* Edit existing customer - with subscription tab */
            <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as typeof dialogTab)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Customer Details</TabsTrigger>
                <TabsTrigger value="subscription">
                  Subscription Products
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Customer name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="customer@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area">Area</Label>
                    <Input
                      id="area"
                      value={formData.area}
                      onChange={(e) =>
                        setFormData({ ...formData, area: e.target.value })
                      }
                      placeholder="e.g., Sector 15, Noida"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Full address"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_cycle">Billing Cycle</Label>
                  <Select
                    value={formData.billing_cycle}
                    onValueChange={(v) =>
                      setFormData({ ...formData, billing_cycle: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="route_edit">Delivery Route</Label>
                  <Select
                    value={formData.route_id || "__none__"}
                    onValueChange={(v) => setFormData({ ...formData, route_id: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select route (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No route assigned</SelectItem>
                      {routes.map((route) => (
                        <SelectItem key={route.id} value={route.id}>
                          {route.name} {route.area && `(${route.area})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.area && !formData.route_id && suggestRouteForArea(formData.area) && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-primary"
                      onClick={() => {
                        const suggested = suggestRouteForArea(formData.area);
                        if (suggested) setFormData({ ...formData, route_id: suggested });
                      }}
                    >
                      💡 Suggest: {routes.find(r => r.id === suggestRouteForArea(formData.area))?.name}
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Any additional notes..."
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => setDialogTab("subscription")}
                    disabled={!formData.name}
                  >
                    Next: Subscription Products
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="subscription" className="mt-4">
                <CustomerSubscriptionSelector
                  value={subscriptionData}
                  onChange={setSubscriptionData}
                />

                <div className="flex justify-between gap-2 pt-4 mt-4 border-t">
                  <Button variant="outline" onClick={() => setDialogTab("details")}>
                    Back
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Update Customer
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Customer"
        description={`Are you sure you want to delete ${selectedCustomer?.name}? This will also delete all related deliveries and invoices.`}
        confirmText="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />

      {/* Vacation Manager */}
      <VacationManager
        customerId={selectedCustomer?.id || ""}
        customerName={selectedCustomer?.name || ""}
        open={vacationDialogOpen}
        onOpenChange={setVacationDialogOpen}
      />

      {/* Customer Ledger */}
      <CustomerLedger
        customerId={selectedCustomer?.id || ""}
        customerName={selectedCustomer?.name || ""}
        open={ledgerDialogOpen}
        onOpenChange={setLedgerDialogOpen}
      />

      {/* Customer Detail Dialog */}
      <CustomerDetailDialog
        customer={selectedCustomer}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />

      {/* Payment Dialog */}
      <ResponsiveDialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <ResponsiveDialogContent className="max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Record Payment</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {paymentCustomer?.name}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {paymentCustomer && (
            <div className="space-y-4 py-2">
              {/* Current Balance */}
              <div className="rounded-lg bg-muted p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Current Due:</span>
                  <span className={Number(paymentCustomer.credit_balance) > 0 ? "text-destructive font-semibold" : "text-success font-semibold"}>
                    ₹{Number(paymentCustomer.credit_balance).toLocaleString("en-IN")}
                  </span>
                </div>
                {Number(paymentCustomer.advance_balance) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Advance Balance:</span>
                    <span className="text-success">₹{Number(paymentCustomer.advance_balance).toLocaleString("en-IN")}</span>
                  </div>
                )}
              </div>

              {/* Invoice Selection */}
              <div className="space-y-2">
                <Label>Apply To</Label>
                <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General / Advance Payment</SelectItem>
                    {loadingInvoices ? (
                      <SelectItem value="loading" disabled>Loading invoices...</SelectItem>
                    ) : (
                      unpaidInvoices.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.invoice_number} — Due: ₹{(Number(inv.final_amount) - Number(inv.paid_amount)).toLocaleString("en-IN")}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label>Payment Amount (₹)</Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                  min="1"
                />
              </div>

              {/* Payment Mode */}
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Reference number or note"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="success"
              onClick={handleRecordPayment} 
              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || recordingPayment}
            >
              {recordingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
