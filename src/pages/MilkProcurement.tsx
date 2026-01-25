import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useExpenseAutomation } from "@/hooks/useExpenseAutomation";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import {
  Milk,
  Plus,
  Edit,
  Trash2,
  Users,
  TrendingUp,
  IndianRupee,
  Calendar,
  Loader2,
  Building2,
  Phone,
  MapPin,
} from "lucide-react";

interface MilkVendor {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  area: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface VendorPartial {
  id: string;
  name: string;
  phone: string | null;
  area: string | null;
}

interface MilkProcurement {
  id: string;
  vendor_id: string | null;
  vendor_name: string | null;
  procurement_date: string;
  session: string;
  quantity_liters: number;
  fat_percentage: number | null;
  snf_percentage: number | null;
  rate_per_liter: number | null;
  total_amount: number | null;
  payment_status: string;
  notes: string | null;
  created_at: string;
  vendor?: VendorPartial | null;
}

interface VendorFormData {
  name: string;
  phone: string;
  address: string;
  area: string;
  notes: string;
}

interface ProcurementFormData {
  vendor_id: string;
  procurement_date: string;
  session: string;
  quantity_liters: string;
  fat_percentage: string;
  snf_percentage: string;
  rate_per_liter: string;
  payment_status: string;
  notes: string;
}

const emptyVendorForm: VendorFormData = {
  name: "",
  phone: "",
  address: "",
  area: "",
  notes: "",
};

const emptyProcurementForm: ProcurementFormData = {
  vendor_id: "",
  procurement_date: format(new Date(), "yyyy-MM-dd"),
  session: "morning",
  quantity_liters: "",
  fat_percentage: "",
  snf_percentage: "",
  rate_per_liter: "",
  payment_status: "pending",
  notes: "",
};

export default function MilkProcurementPage() {
  const [activeTab, setActiveTab] = useState<"records" | "vendors">("records");
  const [vendors, setVendors] = useState<MilkVendor[]>([]);
  const [procurements, setProcurements] = useState<MilkProcurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialogs
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [procurementDialogOpen, setProcurementDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<"vendor" | "procurement">("vendor");

  // Selected items
  const [selectedVendor, setSelectedVendor] = useState<MilkVendor | null>(null);
  const [selectedProcurement, setSelectedProcurement] = useState<MilkProcurement | null>(null);

  // Forms
  const [vendorForm, setVendorForm] = useState<VendorFormData>(emptyVendorForm);
  const [procurementForm, setProcurementForm] = useState<ProcurementFormData>(emptyProcurementForm);

  // Stats
  const [stats, setStats] = useState({
    todayTotal: 0,
    monthTotal: 0,
    totalPending: 0,
    activeVendors: 0,
    avgFat: 0,
    avgRate: 0,
  });

  const { toast } = useToast();
  const { logMilkProcurementExpense } = useExpenseAutomation();
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchVendors(), fetchProcurements()]);
    setLoading(false);
  };

  const fetchVendors = async () => {
    const { data, error } = await supabase
      .from("milk_vendors")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Error fetching vendors",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setVendors(data || []);
    }
  };

  const fetchProcurements = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("milk_procurement")
      .select(`
        *,
        vendor:vendor_id (id, name, phone, area)
      `)
      .gte("procurement_date", format(subDays(new Date(), 30), "yyyy-MM-dd"))
      .order("procurement_date", { ascending: false })
      .order("session", { ascending: true });

    if (error) {
      toast({
        title: "Error fetching procurements",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setProcurements(data || []);

      // Calculate stats
      const todayRecords = (data || []).filter((p) => p.procurement_date === today);
      const monthRecords = (data || []).filter(
        (p) => p.procurement_date >= monthStart && p.procurement_date <= monthEnd
      );
      const pendingRecords = (data || []).filter((p) => p.payment_status === "pending");

      const todayTotal = todayRecords.reduce((sum, p) => sum + Number(p.quantity_liters), 0);
      const monthTotal = monthRecords.reduce((sum, p) => sum + Number(p.quantity_liters), 0);
      const totalPending = pendingRecords.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);

      const fatRecords = (data || []).filter((p) => p.fat_percentage);
      const avgFat = fatRecords.length
        ? fatRecords.reduce((sum, p) => sum + Number(p.fat_percentage), 0) / fatRecords.length
        : 0;

      const rateRecords = (data || []).filter((p) => p.rate_per_liter);
      const avgRate = rateRecords.length
        ? rateRecords.reduce((sum, p) => sum + Number(p.rate_per_liter), 0) / rateRecords.length
        : 0;

      setStats({
        todayTotal,
        monthTotal,
        totalPending,
        activeVendors: vendors.filter((v) => v.is_active).length,
        avgFat,
        avgRate,
      });
    }
  };

  // Vendor handlers
  const handleOpenVendorDialog = (vendor?: MilkVendor) => {
    if (vendor) {
      setSelectedVendor(vendor);
      setVendorForm({
        name: vendor.name,
        phone: vendor.phone || "",
        address: vendor.address || "",
        area: vendor.area || "",
        notes: vendor.notes || "",
      });
    } else {
      setSelectedVendor(null);
      setVendorForm(emptyVendorForm);
    }
    setVendorDialogOpen(true);
  };

  const handleSaveVendor = async () => {
    if (!vendorForm.name) {
      toast({
        title: "Validation Error",
        description: "Vendor name is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const payload = {
      name: vendorForm.name,
      phone: vendorForm.phone || null,
      address: vendorForm.address || null,
      area: vendorForm.area || null,
      notes: vendorForm.notes || null,
    };

    if (selectedVendor) {
      const { error } = await supabase
        .from("milk_vendors")
        .update(payload)
        .eq("id", selectedVendor.id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Vendor updated", description: `${vendorForm.name} has been updated` });
        setVendorDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from("milk_vendors").insert(payload);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Vendor added", description: `${vendorForm.name} has been added` });
        setVendorDialogOpen(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  // Procurement handlers
  const handleOpenProcurementDialog = (procurement?: MilkProcurement) => {
    if (procurement) {
      setSelectedProcurement(procurement);
      setProcurementForm({
        vendor_id: procurement.vendor_id || "",
        procurement_date: procurement.procurement_date,
        session: procurement.session,
        quantity_liters: String(procurement.quantity_liters),
        fat_percentage: procurement.fat_percentage ? String(procurement.fat_percentage) : "",
        snf_percentage: procurement.snf_percentage ? String(procurement.snf_percentage) : "",
        rate_per_liter: procurement.rate_per_liter ? String(procurement.rate_per_liter) : "",
        payment_status: procurement.payment_status,
        notes: procurement.notes || "",
      });
    } else {
      setSelectedProcurement(null);
      setProcurementForm(emptyProcurementForm);
    }
    setProcurementDialogOpen(true);
  };

  const handleSaveProcurement = async () => {
    if (!procurementForm.vendor_id || !procurementForm.quantity_liters) {
      toast({
        title: "Validation Error",
        description: "Vendor and quantity are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    const vendor = vendors.find((v) => v.id === procurementForm.vendor_id);
    const quantity = parseFloat(procurementForm.quantity_liters);
    const rate = procurementForm.rate_per_liter ? parseFloat(procurementForm.rate_per_liter) : null;
    const totalAmount = rate ? quantity * rate : null;

    const payload = {
      vendor_id: procurementForm.vendor_id,
      vendor_name: vendor?.name || null,
      procurement_date: procurementForm.procurement_date,
      session: procurementForm.session,
      quantity_liters: quantity,
      fat_percentage: procurementForm.fat_percentage
        ? parseFloat(procurementForm.fat_percentage)
        : null,
      snf_percentage: procurementForm.snf_percentage
        ? parseFloat(procurementForm.snf_percentage)
        : null,
      rate_per_liter: rate,
      total_amount: totalAmount,
      payment_status: procurementForm.payment_status,
      notes: procurementForm.notes || null,
    };

    // Check if payment status is changing to "paid" (for expense tracking)
    const wasNotPaid = selectedProcurement?.payment_status !== "paid";
    const isNowPaid = procurementForm.payment_status === "paid";
    const shouldLogExpense = wasNotPaid && isNowPaid && totalAmount && rate;

    if (selectedProcurement) {
      const { error } = await supabase
        .from("milk_procurement")
        .update(payload)
        .eq("id", selectedProcurement.id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        // Log expense when payment is marked as paid
        if (shouldLogExpense) {
          await logMilkProcurementExpense(
            vendor?.name || "Unknown Vendor",
            quantity,
            rate!,
            totalAmount!,
            procurementForm.procurement_date,
            selectedProcurement.id,
            procurementForm.session
          );
          toast({ 
            title: "Record updated & expense logged", 
            description: `Payment recorded and expense of ₹${totalAmount?.toLocaleString()} auto-tracked` 
          });
        } else {
          toast({ title: "Record updated", description: "Procurement record updated" });
        }
        setProcurementDialogOpen(false);
        fetchData();
      }
    } else {
      const { data, error } = await supabase
        .from("milk_procurement")
        .insert(payload)
        .select()
        .single();

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        // Log expense if created with "paid" status
        if (isNowPaid && totalAmount && rate && data) {
          await logMilkProcurementExpense(
            vendor?.name || "Unknown Vendor",
            quantity,
            rate,
            totalAmount,
            procurementForm.procurement_date,
            data.id,
            procurementForm.session
          );
          toast({
            title: "Procurement recorded & expense logged",
            description: `${quantity}L from ${vendor?.name || "vendor"} - ₹${totalAmount?.toLocaleString()} auto-tracked`,
          });
        } else {
          toast({
            title: "Procurement recorded",
            description: `${quantity}L from ${vendor?.name || "vendor"}`,
          });
        }
        setProcurementDialogOpen(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  // Delete handlers
  const handleDeleteVendor = async () => {
    if (!selectedVendor) return;

    const { error } = await supabase
      .from("milk_vendors")
      .update({ is_active: false })
      .eq("id", selectedVendor.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Vendor deactivated", description: `${selectedVendor.name} is now inactive` });
      setDeleteDialogOpen(false);
      fetchData();
    }
  };

  const handleDeleteProcurement = async () => {
    if (!selectedProcurement) return;

    const { error } = await supabase
      .from("milk_procurement")
      .delete()
      .eq("id", selectedProcurement.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Record deleted", description: "Procurement record removed" });
      setDeleteDialogOpen(false);
      fetchData();
    }
  };

  const openDeleteDialog = (type: "vendor" | "procurement", item: MilkVendor | MilkProcurement) => {
    setDeleteType(type);
    if (type === "vendor") {
      setSelectedVendor(item as MilkVendor);
    } else {
      setSelectedProcurement(item as MilkProcurement);
    }
    setDeleteDialogOpen(true);
  };

  // Vendor columns
  const vendorColumns = [
    {
      key: "name",
      header: "Vendor Name",
      render: (item: MilkVendor) => (
        <div className="flex flex-col">
          <span className="font-semibold">{item.name}</span>
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
      render: (item: MilkVendor) => (
        <div className="flex items-center gap-1 text-sm">
          {item.phone ? (
            <>
              <Phone className="h-3 w-3" /> {item.phone}
            </>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      key: "address",
      header: "Address",
      render: (item: MilkVendor) => (
        <span className="text-sm">{item.address || "-"}</span>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      render: (item: MilkVendor) => (
        <StatusBadge status={item.is_active ? "active" : "inactive"} />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: MilkVendor) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => handleOpenVendorDialog(item)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => openDeleteDialog("vendor", item)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Procurement columns
  const procurementColumns = [
    {
      key: "date",
      header: "Date",
      render: (item: MilkProcurement) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {format(new Date(item.procurement_date), "dd MMM yyyy")}
          </span>
          <span className="text-xs text-muted-foreground capitalize">{item.session}</span>
        </div>
      ),
    },
    {
      key: "vendor",
      header: "Vendor",
      render: (item: MilkProcurement) => (
        <div className="flex flex-col">
          <span className="font-semibold">{item.vendor?.name || item.vendor_name || "-"}</span>
          {item.vendor?.area && (
            <span className="text-xs text-muted-foreground">{item.vendor.area}</span>
          )}
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Quantity (L)",
      render: (item: MilkProcurement) => (
        <span className="font-bold text-primary">{Number(item.quantity_liters).toFixed(1)}</span>
      ),
    },
    {
      key: "quality",
      header: "Fat / SNF %",
      render: (item: MilkProcurement) => (
        <div className="text-sm">
          {item.fat_percentage || item.snf_percentage ? (
            <>
              <span className="text-orange-600">{item.fat_percentage ?? "-"}</span>
              {" / "}
              <span className="text-blue-600">{item.snf_percentage ?? "-"}</span>
            </>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      key: "rate",
      header: "Rate / Total",
      render: (item: MilkProcurement) => (
        <div className="flex flex-col">
          {item.rate_per_liter ? (
            <>
              <span className="text-sm">₹{Number(item.rate_per_liter).toFixed(2)}/L</span>
              <span className="font-semibold text-green-600">
                ₹{Number(item.total_amount || 0).toFixed(0)}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      key: "payment_status",
      header: "Payment",
      render: (item: MilkProcurement) => (
        <StatusBadge
          status={
            item.payment_status === "paid"
              ? "paid"
              : item.payment_status === "partial"
              ? "partial"
              : "pending"
          }
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: MilkProcurement) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => handleOpenProcurementDialog(item)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => openDeleteDialog("procurement", item)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Milk Procurement"
        description="Manage external milk procurement from vendors"
        icon={Milk}
      >
        <Button variant="outline" onClick={() => handleOpenVendorDialog()}>
          <Building2 className="mr-2 h-4 w-4" />
          Add Vendor
        </Button>
        <Button onClick={() => handleOpenProcurementDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Record Procurement
        </Button>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Today</p>
                <p className="text-2xl font-bold">{stats.todayTotal.toFixed(1)} L</p>
              </div>
              <Calendar className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">{stats.monthTotal.toFixed(0)} L</p>
              </div>
              <TrendingUp className="h-8 w-8 text-success opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Payment</p>
                <p className="text-2xl font-bold">₹{stats.totalPending.toFixed(0)}</p>
              </div>
              <IndianRupee className="h-8 w-8 text-warning opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Vendors</p>
                <p className="text-2xl font-bold">{vendors.filter((v) => v.is_active).length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Fat %</p>
                <p className="text-2xl font-bold">{stats.avgFat.toFixed(1)}%</p>
              </div>
              <Milk className="h-8 w-8 text-orange-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Rate</p>
                <p className="text-2xl font-bold">₹{stats.avgRate.toFixed(1)}</p>
              </div>
              <IndianRupee className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "records" | "vendors")}>
        <TabsList>
          <TabsTrigger value="records">Procurement Records</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Milk className="h-5 w-5" />
                Recent Procurements (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={procurements}
                columns={procurementColumns}
                loading={loading}
                searchPlaceholder="Search by vendor, date..."
                emptyMessage="No procurement records found"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendors" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Milk Vendors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={vendors}
                columns={vendorColumns}
                loading={loading}
                searchPlaceholder="Search vendors..."
                emptyMessage="No vendors found"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Vendor Dialog */}
      <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedVendor ? "Edit Vendor" : "Add New Vendor"}</DialogTitle>
            <DialogDescription>
              {selectedVendor
                ? "Update the vendor details below"
                : "Enter the details for the new milk vendor"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-name">Vendor Name *</Label>
              <Input
                id="vendor-name"
                value={vendorForm.name}
                onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                placeholder="Enter vendor name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-phone">Phone</Label>
              <Input
                id="vendor-phone"
                value={vendorForm.phone}
                onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-area">Area</Label>
              <Input
                id="vendor-area"
                value={vendorForm.area}
                onChange={(e) => setVendorForm({ ...vendorForm, area: e.target.value })}
                placeholder="Village / Area"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-address">Address</Label>
              <Textarea
                id="vendor-address"
                value={vendorForm.address}
                onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                placeholder="Full address"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-notes">Notes</Label>
              <Textarea
                id="vendor-notes"
                value={vendorForm.notes}
                onChange={(e) => setVendorForm({ ...vendorForm, notes: e.target.value })}
                placeholder="Additional notes"
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVendorDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveVendor} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedVendor ? "Update" : "Add Vendor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Procurement Dialog */}
      <Dialog open={procurementDialogOpen} onOpenChange={setProcurementDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedProcurement ? "Edit Procurement" : "Record Milk Procurement"}
            </DialogTitle>
            <DialogDescription>
              {selectedProcurement
                ? "Update the procurement record"
                : "Enter details of milk procured from vendor"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proc-vendor">Vendor *</Label>
                <Select
                  value={procurementForm.vendor_id}
                  onValueChange={(v) => setProcurementForm({ ...procurementForm, vendor_id: v })}
                >
                  <SelectTrigger id="proc-vendor">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors
                      .filter((v) => v.is_active)
                      .map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proc-date">Date *</Label>
                <Input
                  id="proc-date"
                  type="date"
                  value={procurementForm.procurement_date}
                  onChange={(e) =>
                    setProcurementForm({ ...procurementForm, procurement_date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proc-session">Session *</Label>
                <Select
                  value={procurementForm.session}
                  onValueChange={(v) => setProcurementForm({ ...procurementForm, session: v })}
                >
                  <SelectTrigger id="proc-session">
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proc-qty">Quantity (Liters) *</Label>
                <Input
                  id="proc-qty"
                  type="number"
                  step="0.1"
                  value={procurementForm.quantity_liters}
                  onChange={(e) =>
                    setProcurementForm({ ...procurementForm, quantity_liters: e.target.value })
                  }
                  placeholder="0.0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proc-fat">Fat %</Label>
                <Input
                  id="proc-fat"
                  type="number"
                  step="0.1"
                  value={procurementForm.fat_percentage}
                  onChange={(e) =>
                    setProcurementForm({ ...procurementForm, fat_percentage: e.target.value })
                  }
                  placeholder="e.g. 4.5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proc-snf">SNF %</Label>
                <Input
                  id="proc-snf"
                  type="number"
                  step="0.1"
                  value={procurementForm.snf_percentage}
                  onChange={(e) =>
                    setProcurementForm({ ...procurementForm, snf_percentage: e.target.value })
                  }
                  placeholder="e.g. 8.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proc-rate">Rate per Liter (₹)</Label>
                <Input
                  id="proc-rate"
                  type="number"
                  step="0.01"
                  value={procurementForm.rate_per_liter}
                  onChange={(e) =>
                    setProcurementForm({ ...procurementForm, rate_per_liter: e.target.value })
                  }
                  placeholder="e.g. 45.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proc-status">Payment Status</Label>
                <Select
                  value={procurementForm.payment_status}
                  onValueChange={(v) =>
                    setProcurementForm({ ...procurementForm, payment_status: v })
                  }
                >
                  <SelectTrigger id="proc-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Show calculated total */}
            {procurementForm.quantity_liters && procurementForm.rate_per_liter && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Calculated Total:</span>
                  <span className="text-lg font-bold text-green-600">
                    ₹
                    {(
                      parseFloat(procurementForm.quantity_liters) *
                      parseFloat(procurementForm.rate_per_liter)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="proc-notes">Notes</Label>
              <Textarea
                id="proc-notes"
                value={procurementForm.notes}
                onChange={(e) => setProcurementForm({ ...procurementForm, notes: e.target.value })}
                placeholder="Additional notes"
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setProcurementDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProcurement} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedProcurement ? "Update" : "Save Record"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={deleteType === "vendor" ? "Deactivate Vendor?" : "Delete Procurement Record?"}
        description={
          deleteType === "vendor"
            ? `This will deactivate "${selectedVendor?.name}". They will no longer appear in the active vendors list.`
            : "This will permanently delete this procurement record. This action cannot be undone."
        }
        confirmText={deleteType === "vendor" ? "Deactivate" : "Delete"}
        onConfirm={deleteType === "vendor" ? handleDeleteVendor : handleDeleteProcurement}
        variant="destructive"
      />
    </div>
  );
}
