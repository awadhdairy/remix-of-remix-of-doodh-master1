import { useState, useEffect } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, Minus, Trash2, Loader2, Package, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  base_price: number;
  unit: string;
}

interface DeliveryItem {
  id?: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  is_addon?: boolean;
}

interface Subscription {
  product_id: string;
  product_name: string;
  quantity: number;
  custom_price: number | null;
  base_price: number;
}

interface DeliveryItemsEditorProps {
  deliveryId: string;
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function DeliveryItemsEditor({
  deliveryId,
  customerId,
  open,
  onOpenChange,
  onComplete,
}: DeliveryItemsEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (open && deliveryId) {
      fetchData();
    }
  }, [open, deliveryId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, subsRes, itemsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, base_price, unit")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("customer_products")
          .select("product_id, quantity, custom_price, products(name, base_price)")
          .eq("customer_id", customerId)
          .eq("is_active", true),
        supabase
          .from("delivery_items")
          .select("id, product_id, quantity, unit_price, total_amount, products(name)")
          .eq("delivery_id", deliveryId),
      ]);

      if (productsRes.data) setProducts(productsRes.data);

      if (subsRes.data) {
        const formattedSubs = subsRes.data.map((s: any) => ({
          product_id: s.product_id,
          product_name: s.products?.name || "Unknown",
          quantity: s.quantity,
          custom_price: s.custom_price,
          base_price: s.products?.base_price || 0,
        }));
        setSubscriptions(formattedSubs);
      }

      if (itemsRes.data) {
        const subscriptionProductIds = new Set(
          subsRes.data?.map((s: any) => s.product_id) || []
        );
        const formattedItems = itemsRes.data.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.products?.name || "Unknown",
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_amount: item.total_amount,
          is_addon: !subscriptionProductIds.has(item.product_id),
        }));
        setItems(formattedItems);
      } else {
        // Initialize with subscription items if no items exist
        const initialItems = subsRes.data?.map((s: any) => ({
          product_id: s.product_id,
          product_name: s.products?.name || "Unknown",
          quantity: s.quantity,
          unit_price: s.custom_price ?? s.products?.base_price ?? 0,
          total_amount: (s.custom_price ?? s.products?.base_price ?? 0) * s.quantity,
          is_addon: false,
        })) || [];
        setItems(initialItems);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateItemQuantity = (index: number, delta: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const newQty = Math.max(0.25, item.quantity + delta);
          return {
            ...item,
            quantity: newQty,
            total_amount: item.unit_price * newQty,
          };
        }
        return item;
      })
    );
  };

  const setItemQuantity = (index: number, qty: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const newQty = Math.max(0, qty);
          return {
            ...item,
            quantity: newQty,
            total_amount: item.unit_price * newQty,
          };
        }
        return item;
      })
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addProduct = () => {
    if (!selectedProductId) return;

    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    // Check if product already exists
    const existingIndex = items.findIndex((i) => i.product_id === selectedProductId);
    if (existingIndex >= 0) {
      updateItemQuantity(existingIndex, 1);
      setSelectedProductId("");
      return;
    }

    // Check if it's a subscription product
    const subscription = subscriptions.find((s) => s.product_id === selectedProductId);
    const unitPrice = subscription?.custom_price ?? product.base_price;

    setItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: unitPrice,
        total_amount: unitPrice,
        is_addon: !subscription,
      },
    ]);
    setSelectedProductId("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing items
      await supabase.from("delivery_items").delete().eq("delivery_id", deliveryId);

      // Insert new items (only those with quantity > 0)
      const itemsToInsert = items
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          delivery_id: deliveryId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_amount: item.quantity * item.unit_price,
        }));

      if (itemsToInsert.length > 0) {
        const { error } = await supabase.from("delivery_items").insert(itemsToInsert);
        if (error) throw error;
      }

      toast({
        title: "Delivery items updated",
        description: `${itemsToInsert.length} item(s) saved`,
      });
      onComplete?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error saving items",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const total = items.reduce((sum, item) => sum + item.total_amount, 0);
  const addOnsTotal = items
    .filter((item) => item.is_addon)
    .reduce((sum, item) => sum + item.total_amount, 0);

  // Available products to add (not already in items)
  const availableProducts = products.filter(
    (p) => !items.find((i) => i.product_id === p.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Edit Delivery Items
          </DialogTitle>
          <DialogDescription>
            Modify quantities or add extra items (add-ons)
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Items List */}
            <ScrollArea className="h-[280px] pr-4">
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No items. Add products below.
                  </p>
                ) : (
                  items.map((item, index) => (
                    <div
                      key={`${item.product_id}-${index}`}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        item.is_addon
                          ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
                          : "bg-card"
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {item.is_addon && (
                          <Sparkles className="h-4 w-4 text-purple-500 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {item.product_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ₹{item.unit_price}/unit
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateItemQuantity(index, -0.5)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          step="0.25"
                          min="0"
                          value={item.quantity}
                          onChange={(e) =>
                            setItemQuantity(index, parseFloat(e.target.value) || 0)
                          }
                          className="h-7 w-14 text-center text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateItemQuantity(index, 0.5)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="w-16 text-right text-sm font-medium">
                          ₹{item.total_amount.toLocaleString()}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Add Product */}
            <div className="flex gap-2 pt-2 border-t">
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Add a product..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - ₹{product.base_price}/{product.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={addProduct}
                disabled={!selectedProductId}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {/* Totals */}
            <div className="space-y-2 pt-2 border-t">
              {addOnsTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1 text-purple-600">
                    <Sparkles className="h-3 w-3" />
                    Add-ons Total
                  </span>
                  <span className="font-medium text-purple-600">
                    ₹{addOnsTotal.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-medium">Grand Total</span>
                <span className="text-lg font-bold">₹{total.toLocaleString()}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
