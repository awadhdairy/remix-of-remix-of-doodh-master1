import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Truck, CheckCircle, XCircle, Clock, Loader2, Calendar } from "lucide-react";
import { format } from "date-fns";

interface Customer {
  id: string;
  name: string;
  area: string | null;
}

interface Delivery {
  id: string;
  customer_id: string;
  delivery_date: string;
  status: string;
  delivery_time: string | null;
  notes: string | null;
  customer?: Customer;
}

interface DeliveryWithCustomer extends Delivery {
  customer: Customer;
}

export default function DeliveriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deliveries, setDeliveries] = useState<DeliveryWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [formData, setFormData] = useState({
    customer_id: "",
    delivery_date: format(new Date(), "yyyy-MM-dd"),
    status: "pending" as "pending" | "delivered" | "missed" | "partial",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    if (searchParams.get("action") === "add") {
      setDialogOpen(true);
      setSearchParams({});
    }
  }, [searchParams, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch customers
    const { data: customerData } = await supabase
      .from("customers")
      .select("id, name, area")
      .eq("is_active", true)
      .order("name");

    setCustomers(customerData || []);

    // Fetch deliveries for selected date
    const { data: deliveryData, error } = await supabase
      .from("deliveries")
      .select(`
        *,
        customer:customer_id (id, name, area)
      `)
      .eq("delivery_date", selectedDate)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error fetching deliveries",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setDeliveries((deliveryData as DeliveryWithCustomer[]) || []);
    }
    setLoading(false);
  };

  const handleCreateDelivery = async () => {
    if (!formData.customer_id) {
      toast({
        title: "Validation Error",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("deliveries").insert({
      customer_id: formData.customer_id,
      delivery_date: formData.delivery_date,
      status: formData.status,
    });

    setSaving(false);

    if (error) {
      if (error.message.includes("duplicate")) {
        toast({
          title: "Delivery exists",
          description: "A delivery for this customer already exists for the selected date",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error creating delivery",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Delivery created",
        description: "The delivery has been scheduled",
      });
      setDialogOpen(false);
      setFormData({ ...formData, customer_id: "" });
      fetchData();
    }
  };

  const handleUpdateStatus = async (deliveryId: string, newStatus: string) => {
    const { error } = await supabase
      .from("deliveries")
      .update({ 
        status: newStatus as "pending" | "delivered" | "missed" | "partial",
        delivery_time: newStatus === "delivered" ? new Date().toISOString() : null
      })
      .eq("id", deliveryId);

    if (error) {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchData();
    }
  };

  const filteredDeliveries = statusFilter === "all" 
    ? deliveries 
    : deliveries.filter(d => d.status === statusFilter);

  const stats = {
    total: deliveries.length,
    pending: deliveries.filter(d => d.status === "pending").length,
    delivered: deliveries.filter(d => d.status === "delivered").length,
    missed: deliveries.filter(d => d.status === "missed").length,
  };

  const columns = [
    {
      key: "customer",
      header: "Customer",
      render: (item: DeliveryWithCustomer) => (
        <div className="flex flex-col">
          <span className="font-semibold">{item.customer?.name}</span>
          {item.customer?.area && (
            <span className="text-xs text-muted-foreground">{item.customer.area}</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: DeliveryWithCustomer) => <StatusBadge status={item.status} />,
    },
    {
      key: "delivery_time",
      header: "Time",
      render: (item: DeliveryWithCustomer) =>
        item.delivery_time
          ? format(new Date(item.delivery_time), "hh:mm a")
          : "-",
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: DeliveryWithCustomer) => (
        <div className="flex items-center gap-1">
          {item.status === "pending" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-success hover:text-success hover:bg-success/10"
                onClick={() => handleUpdateStatus(item.id, "delivered")}
              >
                <CheckCircle className="h-4 w-4 mr-1" /> Done
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleUpdateStatus(item.id, "missed")}
              >
                <XCircle className="h-4 w-4 mr-1" /> Missed
              </Button>
            </>
          )}
          {item.status !== "pending" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleUpdateStatus(item.id, "pending")}
            >
              <Clock className="h-4 w-4 mr-1" /> Reset
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deliveries"
        description="Manage daily deliveries"
        icon={Truck}
        action={{
          label: "Add Delivery",
          onClick: () => setDialogOpen(true),
        }}
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
        </div>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter("all")}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-warning/50 transition-colors" onClick={() => setStatusFilter("pending")}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-success/50 transition-colors" onClick={() => setStatusFilter("delivered")}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">{stats.delivered}</div>
            <p className="text-sm text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-destructive/50 transition-colors" onClick={() => setStatusFilter("missed")}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{stats.missed}</div>
            <p className="text-sm text-muted-foreground">Missed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
          <TabsTrigger value="delivered">Delivered ({stats.delivered})</TabsTrigger>
          <TabsTrigger value="missed">Missed ({stats.missed})</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        data={filteredDeliveries}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search by customer name..."
        emptyMessage={`No ${statusFilter === "all" ? "" : statusFilter + " "}deliveries for ${format(new Date(selectedDate), "dd MMM yyyy")}`}
      />

      {/* Add Delivery Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Delivery</DialogTitle>
            <DialogDescription>
              Add a new delivery for a customer
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select
                value={formData.customer_id}
                onValueChange={(v) => setFormData({ ...formData, customer_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.area && `(${c.area})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Delivery Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Initial Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v as typeof formData.status })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDelivery} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Schedule Delivery
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
