import { useState, useEffect } from "react";
import { useInventoryData, FeedItem, FeedFormData } from "@/hooks/useInventoryData";
import { useTelegramNotify } from "@/hooks/useTelegramNotify";
import { InventoryPageSkeleton } from "@/components/common/PageSkeletons";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wheat, Loader2, AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const categoryColors: Record<string, string> = {
  green_fodder: "bg-success/10 text-success border-success/20",
  dry_fodder: "bg-warning/10 text-warning border-warning/20",
  fodder: "bg-success/10 text-success border-success/20", // Legacy support
  concentrate: "bg-info/10 text-info border-info/20",
  supplement: "bg-primary/10 text-primary border-primary/20",
  medicine: "bg-destructive/10 text-destructive border-destructive/20",
  byproduct: "bg-muted text-muted-foreground border-muted-foreground/20", // Legacy support
};

const emptyFormData: FeedFormData = { name: "", category: "green_fodder", unit: "kg", current_stock: "", min_stock_level: "", cost_per_unit: "", supplier: "" };

export default function InventoryPage() {
  const { items, consumption, isLoading, createItem, updateItem, updateStock, isCreating, isUpdating, isUpdatingStock } = useInventoryData();
  const { notifyLowInventory } = useTelegramNotify();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  const [formData, setFormData] = useState<FeedFormData>(emptyFormData);
  const [stockChange, setStockChange] = useState({ type: "add", quantity: "" });

  if (isLoading) return <InventoryPageSkeleton />;

  const handleSaveItem = () => {
    if (!formData.name) return;
    if (selectedItem) {
      updateItem({ id: selectedItem.id, formData }, { onSuccess: () => { setDialogOpen(false); setSelectedItem(null); setFormData(emptyFormData); } });
    } else {
      createItem(formData, { onSuccess: () => { setDialogOpen(false); setFormData(emptyFormData); } });
    }
  };

  const handleStockUpdate = () => {
    if (!selectedItem || !stockChange.quantity) return;
    const quantity = parseFloat(stockChange.quantity);
    const type = stockChange.type as "add" | "consume";
    
    // Calculate what the new stock will be after this update
    const newStock = type === "add" 
      ? selectedItem.current_stock + quantity 
      : Math.max(0, selectedItem.current_stock - quantity);
    
    updateStock({ item: selectedItem, type, quantity }, { 
      onSuccess: () => { 
        // Check if stock fell below minimum level after consume
        if (type === "consume" && newStock <= selectedItem.min_stock_level) {
          notifyLowInventory({
            item_name: selectedItem.name,
            current_stock: newStock,
            min_level: selectedItem.min_stock_level,
            unit: selectedItem.unit,
          });
        }
        setStockDialogOpen(false); 
        setStockChange({ type: "add", quantity: "" }); 
        setSelectedItem(null); 
      } 
    });
  };

  const lowStockItems = items.filter((i) => i.current_stock <= i.min_stock_level);
  const totalValue = items.reduce((sum, i) => sum + i.current_stock * (i.cost_per_unit || 0), 0);

  const columns = [
    { key: "name", header: "Item", render: (item: FeedItem) => (<div className="flex flex-col"><span className="font-medium">{item.name}</span><span className="text-xs text-muted-foreground">{item.supplier || "No supplier"}</span></div>) },
    { key: "category", header: "Category", render: (item: FeedItem) => (<Badge variant="outline" className={cn("capitalize", categoryColors[item.category])}>{item.category.replace("_", " ")}</Badge>) },
    { key: "current_stock", header: "Stock", render: (item: FeedItem) => { const isLow = item.current_stock <= item.min_stock_level; const pct = item.min_stock_level > 0 ? Math.min(100, (item.current_stock / (item.min_stock_level * 3)) * 100) : 100; return (<div className="w-32"><div className="flex items-center justify-between mb-1"><span className={cn("font-medium", isLow && "text-destructive")}>{item.current_stock} {item.unit}</span>{isLow && <AlertTriangle className="h-4 w-4 text-destructive" />}</div><Progress value={pct} className={cn("h-1.5", isLow && "[&>div]:bg-destructive")} /></div>); } },
    { key: "min_stock_level", header: "Min Level", render: (item: FeedItem) => `${item.min_stock_level} ${item.unit}` },
    { key: "cost_per_unit", header: "Unit Cost", render: (item: FeedItem) => item.cost_per_unit ? `₹${item.cost_per_unit}/${item.unit}` : "-" },
    { key: "actions", header: "Actions", render: (item: FeedItem) => (<div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => { setSelectedItem(item); setStockDialogOpen(true); }}>Update Stock</Button><Button variant="ghost" size="sm" onClick={() => { setSelectedItem(item); setFormData({ name: item.name, category: item.category, unit: item.unit, current_stock: item.current_stock.toString(), min_stock_level: item.min_stock_level.toString(), cost_per_unit: item.cost_per_unit?.toString() || "", supplier: item.supplier || "" }); setDialogOpen(true); }}>Edit</Button></div>) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Feed & Inventory" description="Manage fodder, feed, and supplies" icon={Wheat} action={{ label: "Add Item", onClick: () => { setSelectedItem(null); setFormData(emptyFormData); setDialogOpen(true); } }} />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{items.length}</div><p className="text-sm text-muted-foreground">Total Items</p></CardContent></Card>
        <Card className="border-success/30"><CardContent className="pt-6"><div className="text-2xl font-bold text-success">₹{totalValue.toLocaleString()}</div><p className="text-sm text-muted-foreground">Stock Value</p></CardContent></Card>
        <Card className="border-destructive/30"><CardContent className="pt-6"><div className="text-2xl font-bold text-destructive">{lowStockItems.length}</div><p className="text-sm text-muted-foreground">Low Stock Items</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{consumption.filter(c => c.consumption_date === format(new Date(), "yyyy-MM-dd")).reduce((sum, c) => sum + c.quantity, 0)} kg</div><p className="text-sm text-muted-foreground">Today's Usage</p></CardContent></Card>
      </div>

      {lowStockItems.length > 0 && (<Card className="border-destructive/30 bg-destructive/5"><CardContent className="pt-6"><div className="flex items-center gap-2 mb-3"><AlertTriangle className="h-5 w-5 text-destructive" /><h3 className="font-semibold">Low Stock Alert</h3></div><div className="flex flex-wrap gap-2">{lowStockItems.map((item) => (<Badge key={item.id} variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">{item.name}: {item.current_stock} {item.unit}</Badge>))}</div></CardContent></Card>)}

      <DataTable data={items} columns={columns} loading={isLoading} searchPlaceholder="Search items..." emptyMessage="No inventory items. Add your first item." />

      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent className="max-w-md">
          <ResponsiveDialogHeader><ResponsiveDialogTitle>{selectedItem ? "Edit Item" : "Add Inventory Item"}</ResponsiveDialogTitle><ResponsiveDialogDescription>Manage feed and supply items</ResponsiveDialogDescription></ResponsiveDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Item Name *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Green Grass" /></div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2"><Label>Category</Label><Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="green_fodder">Green Fodder</SelectItem><SelectItem value="dry_fodder">Dry Fodder</SelectItem><SelectItem value="concentrate">Concentrate</SelectItem><SelectItem value="supplement">Supplement</SelectItem><SelectItem value="medicine">Medicine</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Unit</Label><Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="kg">Kilogram</SelectItem><SelectItem value="quintal">Quintal</SelectItem><SelectItem value="liter">Liter</SelectItem><SelectItem value="piece">Piece</SelectItem><SelectItem value="bundle">Bundle</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2"><Label>Current Stock</Label><Input type="number" value={formData.current_stock} onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })} placeholder="0" /></div>
              <div className="space-y-2"><Label>Min Stock Level</Label><Input type="number" value={formData.min_stock_level} onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })} placeholder="0" /></div>
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2"><Label>Cost per Unit (₹)</Label><Input type="number" value={formData.cost_per_unit} onChange={(e) => setFormData({ ...formData, cost_per_unit: e.target.value })} placeholder="0" /></div>
              <div className="space-y-2"><Label>Supplier</Label><Input value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} placeholder="Supplier name" /></div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t"><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSaveItem} disabled={isCreating || isUpdating}>{(isCreating || isUpdating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {selectedItem ? "Update" : "Add"} Item</Button></div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <ResponsiveDialogContent className="max-w-sm">
          <ResponsiveDialogHeader><ResponsiveDialogTitle>Update Stock</ResponsiveDialogTitle><ResponsiveDialogDescription>{selectedItem?.name} - Current: {selectedItem?.current_stock} {selectedItem?.unit}</ResponsiveDialogDescription></ResponsiveDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Action</Label><Tabs value={stockChange.type} onValueChange={(v) => setStockChange({ ...stockChange, type: v })}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="add" className="gap-1"><ArrowUp className="h-4 w-4" /> Add Stock</TabsTrigger><TabsTrigger value="consume" className="gap-1"><ArrowDown className="h-4 w-4" /> Consume</TabsTrigger></TabsList></Tabs></div>
            <div className="space-y-2"><Label>Quantity ({selectedItem?.unit})</Label><Input type="number" value={stockChange.quantity} onChange={(e) => setStockChange({ ...stockChange, quantity: e.target.value })} placeholder="0" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t"><Button variant="outline" onClick={() => setStockDialogOpen(false)}>Cancel</Button><Button onClick={handleStockUpdate} disabled={isUpdatingStock}>{isUpdatingStock && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update</Button></div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
