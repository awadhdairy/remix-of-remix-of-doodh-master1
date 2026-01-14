import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useExpenseAutomation } from "@/hooks/useExpenseAutomation";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Wrench, Package, AlertTriangle, Calendar, Loader2, Settings } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface Equipment {
  id: string;
  name: string;
  category: string;
  model: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  warranty_expiry: string | null;
  status: string;
  location: string | null;
  notes: string | null;
}

interface MaintenanceRecord {
  id: string;
  equipment_id: string;
  maintenance_type: string;
  maintenance_date: string;
  description: string | null;
  cost: number;
  performed_by: string | null;
  next_maintenance_date: string | null;
  notes: string | null;
}

const categories = [
  "Milking Equipment",
  "Cooling & Storage",
  "Feeding Equipment",
  "Farm Vehicles",
  "Cleaning Equipment",
  "Medical Equipment",
  "Other",
];

const statusColors: Record<string, string> = {
  active: "bg-success",
  under_maintenance: "bg-warning",
  retired: "bg-status-inactive",
};

export default function EquipmentPage() {
  const { toast } = useToast();
  const { logEquipmentPurchase, logMaintenanceExpense } = useExpenseAutomation();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  
  // Equipment form
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");

  // Maintenance form
  const [selectedEquipment, setSelectedEquipment] = useState("");
  const [maintenanceType, setMaintenanceType] = useState("scheduled");
  const [maintenanceDate, setMaintenanceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [eqRes, maintRes] = await Promise.all([
        supabase.from("equipment").select("*").order("name"),
        supabase.from("maintenance_records").select("*").order("maintenance_date", { ascending: false }),
      ]);

      if (eqRes.data) setEquipment(eqRes.data);
      if (maintRes.data) setMaintenance(maintRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEquipment = async () => {
    if (!name || !category) {
      toast({ title: "Error", description: "Name and category are required", variant: "destructive" });
      return;
    }

    const { data, error } = await supabase.from("equipment").insert({
      name,
      category,
      model: model || null,
      serial_number: serialNumber || null,
      purchase_date: purchaseDate || null,
      purchase_cost: purchaseCost ? parseFloat(purchaseCost) : null,
      warranty_expiry: warrantyExpiry || null,
      location: location || null,
      status,
      notes: notes || null,
    }).select().single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Auto-create expense entry for equipment purchase
      if (purchaseCost && parseFloat(purchaseCost) > 0 && data) {
        await logEquipmentPurchase(
          name,
          parseFloat(purchaseCost),
          purchaseDate || format(new Date(), "yyyy-MM-dd"),
          data.id
        );
      }
      toast({ title: "Success", description: "Equipment added & expense recorded" });
      setEquipmentDialogOpen(false);
      resetEquipmentForm();
      fetchData();
    }
  };

  const handleCreateMaintenance = async () => {
    if (!selectedEquipment || !maintenanceType || !maintenanceDate) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }

    const { data, error } = await supabase.from("maintenance_records").insert({
      equipment_id: selectedEquipment,
      maintenance_type: maintenanceType,
      maintenance_date: maintenanceDate,
      description: description || null,
      cost: cost ? parseFloat(cost) : 0,
      performed_by: performedBy || null,
      next_maintenance_date: nextMaintenanceDate || null,
    }).select().single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Auto-create expense entry for maintenance cost
      if (cost && parseFloat(cost) > 0 && data) {
        const equipmentName = equipment.find(e => e.id === selectedEquipment)?.name || "Unknown Equipment";
        await logMaintenanceExpense(
          equipmentName,
          maintenanceType,
          parseFloat(cost),
          maintenanceDate,
          data.id
        );
      }
      toast({ title: "Success", description: "Maintenance record added & expense recorded" });
      setMaintenanceDialogOpen(false);
      resetMaintenanceForm();
      fetchData();
    }
  };

  const resetEquipmentForm = () => {
    setName("");
    setCategory("");
    setModel("");
    setSerialNumber("");
    setPurchaseDate("");
    setPurchaseCost("");
    setWarrantyExpiry("");
    setLocation("");
    setStatus("active");
    setNotes("");
  };

  const resetMaintenanceForm = () => {
    setSelectedEquipment("");
    setMaintenanceType("scheduled");
    setMaintenanceDate(format(new Date(), "yyyy-MM-dd"));
    setDescription("");
    setCost("");
    setPerformedBy("");
    setNextMaintenanceDate("");
  };

  const getEquipmentName = (id: string) => equipment.find(e => e.id === id)?.name || "Unknown";

  // Stats
  const totalEquipment = equipment.length;
  const activeEquipment = equipment.filter(e => e.status === "active").length;
  const underMaintenance = equipment.filter(e => e.status === "under_maintenance").length;
  const totalMaintenanceCost = maintenance.reduce((sum, m) => sum + (m.cost || 0), 0);

  // Upcoming maintenance
  const upcomingMaintenance = maintenance
    .filter(m => m.next_maintenance_date && new Date(m.next_maintenance_date) >= new Date())
    .sort((a, b) => new Date(a.next_maintenance_date!).getTime() - new Date(b.next_maintenance_date!).getTime())
    .slice(0, 5);

  // Warranty expiring soon
  const warrantyExpiringSoon = equipment
    .filter(e => e.warranty_expiry && differenceInDays(new Date(e.warranty_expiry), new Date()) <= 30 && differenceInDays(new Date(e.warranty_expiry), new Date()) >= 0)
    .slice(0, 5);

  const equipmentColumns = [
    { key: "name" as const, header: "Name" },
    { key: "category" as const, header: "Category" },
    { key: "model" as const, header: "Model", render: (row: Equipment) => row.model || "-" },
    { key: "location" as const, header: "Location", render: (row: Equipment) => row.location || "-" },
    { key: "purchase_cost" as const, header: "Cost", render: (row: Equipment) => row.purchase_cost ? `₹${row.purchase_cost.toLocaleString()}` : "-" },
    { 
      key: "warranty_expiry" as const, 
      header: "Warranty", 
      render: (row: Equipment) => {
        if (!row.warranty_expiry) return "-";
        const daysLeft = differenceInDays(new Date(row.warranty_expiry), new Date());
        return (
          <span className={daysLeft <= 30 ? "text-destructive" : ""}>
            {format(new Date(row.warranty_expiry), "dd MMM yyyy")}
          </span>
        );
      }
    },
    { 
      key: "status" as const, 
      header: "Status", 
      render: (row: Equipment) => (
        <Badge className={`${statusColors[row.status]} text-white`}>
          {row.status.replace("_", " ")}
        </Badge>
      )
    },
  ];

  const maintenanceColumns = [
    { key: "maintenance_date" as const, header: "Date", render: (row: MaintenanceRecord) => format(new Date(row.maintenance_date), "dd MMM yyyy") },
    { key: "equipment_id" as const, header: "Equipment", render: (row: MaintenanceRecord) => getEquipmentName(row.equipment_id) },
    { 
      key: "maintenance_type" as const, 
      header: "Type", 
      render: (row: MaintenanceRecord) => (
        <Badge variant={row.maintenance_type === "repair" ? "destructive" : "secondary"}>
          {row.maintenance_type}
        </Badge>
      )
    },
    { key: "description" as const, header: "Description", render: (row: MaintenanceRecord) => row.description || "-" },
    { key: "cost" as const, header: "Cost", render: (row: MaintenanceRecord) => `₹${row.cost.toLocaleString()}` },
    { key: "performed_by" as const, header: "Performed By", render: (row: MaintenanceRecord) => row.performed_by || "-" },
    { 
      key: "next_maintenance_date" as const, 
      header: "Next Maintenance", 
      render: (row: MaintenanceRecord) => row.next_maintenance_date ? format(new Date(row.next_maintenance_date), "dd MMM yyyy") : "-" 
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment Management"
        description="Track equipment, maintenance schedules, and warranties"
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Equipment</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEquipment}</div>
            <p className="text-xs text-muted-foreground">{activeEquipment} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Under Maintenance</CardTitle>
            <Wrench className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{underMaintenance}</div>
            <p className="text-xs text-muted-foreground">being serviced</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Warranty Expiring</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{warrantyExpiringSoon.length}</div>
            <p className="text-xs text-muted-foreground">within 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Maintenance Cost</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalMaintenanceCost.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="equipment" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="equipment">Equipment</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Dialog open={equipmentDialogOpen} onOpenChange={setEquipmentDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Add Equipment</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Equipment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Equipment name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Model</Label>
                      <Input value={model} onChange={e => setModel(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Serial Number</Label>
                      <Input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Purchase Date</Label>
                      <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Purchase Cost (₹)</Label>
                      <Input type="number" value={purchaseCost} onChange={e => setPurchaseCost(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Warranty Expiry</Label>
                      <Input type="date" value={warrantyExpiry} onChange={e => setWarrantyExpiry(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input value={location} onChange={e => setLocation(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={handleCreateEquipment}>Add Equipment</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><Wrench className="mr-2 h-4 w-4" /> Log Maintenance</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Maintenance</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Equipment *</Label>
                    <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                      <SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger>
                      <SelectContent>
                        {equipment.map(eq => (
                          <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type *</Label>
                      <Select value={maintenanceType} onValueChange={setMaintenanceType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="repair">Repair</SelectItem>
                          <SelectItem value="inspection">Inspection</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date *</Label>
                      <Input type="date" value={maintenanceDate} onChange={e => setMaintenanceDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cost (₹)</Label>
                      <Input type="number" value={cost} onChange={e => setCost(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Performed By</Label>
                      <Input value={performedBy} onChange={e => setPerformedBy(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Next Maintenance Date</Label>
                    <Input type="date" value={nextMaintenanceDate} onChange={e => setNextMaintenanceDate(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={handleCreateMaintenance}>Save Record</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <TabsContent value="equipment">
          <Card>
            <CardHeader>
              <CardTitle>All Equipment</CardTitle>
              <CardDescription>Manage dairy equipment inventory</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable data={equipment} columns={equipmentColumns} searchable searchPlaceholder="Search equipment..." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance History</CardTitle>
              <CardDescription>All maintenance records</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable data={maintenance} columns={maintenanceColumns} searchable searchPlaceholder="Search records..." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Upcoming Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingMaintenance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No scheduled maintenance</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingMaintenance.map(record => {
                      const daysLeft = differenceInDays(new Date(record.next_maintenance_date!), new Date());
                      return (
                        <div key={record.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="font-medium">{getEquipmentName(record.equipment_id)}</p>
                            <p className="text-sm text-muted-foreground">{record.maintenance_type}</p>
                          </div>
                          <Badge variant={daysLeft <= 7 ? "destructive" : "secondary"}>
                            {daysLeft === 0 ? "Today" : `${daysLeft} days`}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Warranty Expiring Soon
                </CardTitle>
              </CardHeader>
              <CardContent>
                {warrantyExpiringSoon.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No warranties expiring soon</p>
                ) : (
                  <div className="space-y-3">
                    {warrantyExpiringSoon.map(eq => {
                      const daysLeft = differenceInDays(new Date(eq.warranty_expiry!), new Date());
                      return (
                        <div key={eq.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="font-medium">{eq.name}</p>
                            <p className="text-sm text-muted-foreground">{eq.category}</p>
                          </div>
                          <Badge variant="destructive">
                            {daysLeft === 0 ? "Expires today" : `${daysLeft} days left`}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
