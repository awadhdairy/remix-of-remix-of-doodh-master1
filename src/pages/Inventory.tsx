import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExpenseAutomation } from "@/hooks/useExpenseAutomation";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { Wheat, Plus, Loader2, AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface FeedItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock_level: number;
  cost_per_unit: number | null;
  supplier: string | null;
}

interface FeedConsumption {
  id: string;
  feed_id: string;
  cattle_id: string | null;
  consumption_date: string;
  quantity: number;
  created_at: string;
}

const categoryColors: Record<string, string> = {
  green_fodder: "bg-success/10 text-success border-success/20",
  dry_fodder: "bg-warning/10 text-warning border-warning/20",
  concentrate: "bg-info/10 text-info border-info/20",
  supplement: "bg-primary/10 text-primary border-primary/20",
  medicine: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function InventoryPage() {
  const { logFeedPurchase } = useExpenseAutomation();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [consumption, setConsumption] = useState<FeedConsumption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "green_fodder",
    unit: "kg",
    current_stock: "",
    min_stock_level: "",
    cost_per_unit: "",
    supplier: "",
  });
  const [stockChange, setStockChange] = useState({ type: "add", quantity: "", notes: "" });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const [itemsRes, consumptionRes] = await Promise.all([
      supabase.from("feed_inventory").select("*").order("category").order("name"),
      supabase.from("feed_consumption").select("*").order("consumption_date", { ascending: false }).limit(50),
    ]);

    if (itemsRes.data) setItems(itemsRes.data);
    if (consumptionRes.data) setConsumption(consumptionRes.data);

    setLoading(false);
  };

  const handleSaveItem = async () => {
    if (!formData.name) {
      toast({ title: "Enter item name", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      name: formData.name,
      category: formData.category,
      unit: formData.unit,
      current_stock: parseFloat(formData.current_stock) || 0,
      min_stock_level: parseFloat(formData.min_stock_level) || 0,
      cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : null,
      supplier: formData.supplier || null,
    };

    const { error } = selectedItem
      ? await supabase.from("feed_inventory").update(payload).eq("id", selectedItem.id)
      : await supabase.from("feed_inventory").insert(payload);

    setSaving(false);

    if (error) {
      toast({ title: "Error saving item", description: error.message, variant: "destructive" });
    } else {
      toast({ title: selectedItem ? "Item updated" : "Item added" });
      setDialogOpen(false);
      setSelectedItem(null);
      setFormData({ name: "", category: "green_fodder", unit: "kg", current_stock: "", min_stock_level: "", cost_per_unit: "", supplier: "" });
      fetchData();
    }
  };

  const handleStockUpdate = async () => {
    if (!selectedItem || !stockChange.quantity) return;

    setSaving(true);
    const qty = parseFloat(stockChange.quantity);
    const newStock = stockChange.type === "add" 
      ? selectedItem.current_stock + qty 
      : Math.max(0, selectedItem.current_stock - qty);

    const { error } = await supabase
      .from("feed_inventory")
      .update({ current_stock: newStock })
      .eq("id", selectedItem.id);

    if (stockChange.type === "consume") {
      await supabase.from("feed_consumption").insert({
        feed_id: selectedItem.id,
        consumption_date: format(new Date(), "yyyy-MM-dd"),
        quantity: qty,
      });
    }

    // Auto-create expense entry when adding stock (purchase)
    if (stockChange.type === "add" && selectedItem.cost_per_unit && selectedItem.cost_per_unit > 0) {
      await logFeedPurchase(
        selectedItem.name,
        qty,
        selectedItem.cost_per_unit,
        selectedItem.unit,
        format(new Date(), "yyyy-MM-dd")
      );
    }

    setSaving(false);

    if (error) {
      toast({ title: "Error updating stock", description: error.message, variant: "destructive" });
    } else {
      const message = stockChange.type === "add" && selectedItem.cost_per_unit 
        ? "Stock updated & expense recorded" 
        : "Stock updated";
      toast({ title: message });
      setStockDialogOpen(false);
      setStockChange({ type: "add", quantity: "", notes: "" });
      setSelectedItem(null);
      fetchData();
    }
  };

  const openEditDialog = (item: FeedItem) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      unit: item.unit,
      current_stock: item.current_stock.toString(),
      min_stock_level: item.min_stock_level.toString(),
      cost_per_unit: item.cost_per_unit?.toString() || "",
      supplier: item.supplier || "",
    });
    setDialogOpen(true);
  };

  const openStockDialog = (item: FeedItem) => {
    setSelectedItem(item);
    setStockDialogOpen(true);
  };

  const lowStockItems = items.filter(i => i.current_stock <= i.min_stock_level);
  const totalValue = items.reduce((sum, i) => sum + (i.current_stock * (i.cost_per_unit || 0)), 0);

  const columns = [
    {
      key: "name",
      header: "Item",
      render: (item: FeedItem) => (
        <div className="flex flex-col">
          <span className="font-medium">{item.name}</span>
          <span className="text-xs text-muted-foreground">{item.supplier || "No supplier"}</span>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (item: FeedItem) => (
        <Badge variant="outline" className={cn("capitalize", categoryColors[item.category])}>
          {item.category.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "current_stock",
      header: "Stock",
      render: (item: FeedItem) => {
        const isLow = item.current_stock <= item.min_stock_level;
        const percentage = item.min_stock_level > 0 
          ? Math.min(100, (item.current_stock / (item.min_stock_level * 3)) * 100)
          : 100;
        return (
          <div className="w-32">
            <div className="flex items-center justify-between mb-1">
              <span className={cn("font-medium", isLow && "text-destructive")}>
                {item.current_stock} {item.unit}
              </span>
              {isLow && <AlertTriangle className="h-4 w-4 text-destructive" />}
            </div>
            <Progress value={percentage} className={cn("h-1.5", isLow && "[&>div]:bg-destructive")} />
          </div>
        );
      },
    },
    {
      key: "min_stock_level",
      header: "Min Level",
      render: (item: FeedItem) => `${item.min_stock_level} ${item.unit}`,
    },
    {
      key: "cost_per_unit",
      header: "Unit Cost",
      render: (item: FeedItem) => item.cost_per_unit ? `₹${item.cost_per_unit}/${item.unit}` : "-",
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: FeedItem) => (
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => openStockDialog(item)}>
            Update Stock
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEditDialog(item)}>
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feed & Inventory"
        description="Manage fodder, feed, and supplies"
        icon={Wheat}
        action={{
          label: "Add Item",
          onClick: () => {
            setSelectedItem(null);
            setFormData({ name: "", category: "green_fodder", unit: "kg", current_stock: "", min_stock_level: "", cost_per_unit: "", supplier: "" });
            setDialogOpen(true);
          },
        }}
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{items.length}</div>
            <p className="text-sm text-muted-foreground">Total Items</p>
          </CardContent>
        </Card>
        <Card className="border-success/30">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">₹{totalValue.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Stock Value</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{lowStockItems.length}</div>
            <p className="text-sm text-muted-foreground">Low Stock Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {consumption.filter(c => c.consumption_date === format(new Date(), "yyyy-MM-dd")).reduce((sum, c) => sum + c.quantity, 0)} kg
            </div>
            <p className="text-sm text-muted-foreground">Today's Usage</p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h3 className="font-semibold">Low Stock Alert</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map((item) => (
                <Badge key={item.id} variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                  {item.name}: {item.current_stock} {item.unit}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable
        data={items}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search items..."
        emptyMessage="No inventory items. Add your first item."
      />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedItem ? "Edit Item" : "Add Inventory Item"}</DialogTitle>
            <DialogDescription>Manage feed and supply items</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Green Grass" />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green_fodder">Green Fodder</SelectItem>
                    <SelectItem value="dry_fodder">Dry Fodder</SelectItem>
                    <SelectItem value="concentrate">Concentrate</SelectItem>
                    <SelectItem value="supplement">Supplement</SelectItem>
                    <SelectItem value="medicine">Medicine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilogram</SelectItem>
                    <SelectItem value="quintal">Quintal</SelectItem>
                    <SelectItem value="liter">Liter</SelectItem>
                    <SelectItem value="piece">Piece</SelectItem>
                    <SelectItem value="bundle">Bundle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Current Stock</Label>
                <Input type="number" value={formData.current_stock} onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Min Stock Level</Label>
                <Input type="number" value={formData.min_stock_level} onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Cost per Unit (₹)</Label>
                <Input type="number" value={formData.cost_per_unit} onChange={(e) => setFormData({ ...formData, cost_per_unit: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Input value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} placeholder="Supplier name" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveItem} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {selectedItem ? "Update" : "Add"} Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock Update Dialog */}
      <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Stock</DialogTitle>
            <DialogDescription>{selectedItem?.name} - Current: {selectedItem?.current_stock} {selectedItem?.unit}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Tabs value={stockChange.type} onValueChange={(v) => setStockChange({ ...stockChange, type: v })}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="add" className="gap-1"><ArrowUp className="h-4 w-4" /> Add Stock</TabsTrigger>
                  <TabsTrigger value="consume" className="gap-1"><ArrowDown className="h-4 w-4" /> Consume</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-2">
              <Label>Quantity ({selectedItem?.unit})</Label>
              <Input type="number" value={stockChange.quantity} onChange={(e) => setStockChange({ ...stockChange, quantity: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStockDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStockUpdate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
