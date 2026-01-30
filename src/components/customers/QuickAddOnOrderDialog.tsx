import { useState, useEffect } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Minus, CalendarIcon, Loader2, ShoppingCart, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  base_price: number;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit: string;
}

interface QuickAddOnOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  onSuccess?: () => void;
}

export function QuickAddOnOrderDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onSuccess,
}: QuickAddOnOrderDialogProps) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date());
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (open) {
      fetchProducts();
      setOrderItems([]);
      setDeliveryDate(new Date());
    }
  }, [open]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category, unit, base_price")
      .eq("is_active", true)
      .order("category")
      .order("name");

    if (!error && data) {
      setProducts(data);
    }
    setLoading(false);
  };

  const handleProductToggle = (product: Product) => {
    const existing = orderItems.find((p) => p.product_id === product.id);
    if (existing) {
      setOrderItems(orderItems.filter((p) => p.product_id !== product.id));
    } else {
      setOrderItems([
        ...orderItems,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: product.base_price,
          unit: product.unit,
        },
      ]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setOrderItems(
      orderItems.map((item) => {
        if (item.product_id === productId) {
          const newQty = Math.max(0.25, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const setQuantity = (productId: string, qty: number) => {
    setOrderItems(
      orderItems.map((item) => {
        if (item.product_id === productId) {
          return { ...item, quantity: Math.max(0.25, qty) };
        }
        return item;
      })
    );
  };

  const totalAmount = orderItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  const handleSaveOrder = async () => {
    if (orderItems.length === 0) {
      toast.error("Please select at least one product");
      return;
    }

    setSaving(true);
    try {
      // Create delivery record with delivery_time since it's marked as delivered
      const currentTime = new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      
      const { data: delivery, error: deliveryError } = await supabase
        .from("deliveries")
        .insert({
          customer_id: customerId,
          delivery_date: format(deliveryDate, "yyyy-MM-dd"),
          status: "delivered",
          delivery_time: currentTime,
          notes: "Add-on order",
        })
        .select("id")
        .single();

      if (deliveryError) throw deliveryError;

      // Create delivery items
      const deliveryItems = orderItems.map((item) => ({
        delivery_id: delivery.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_amount: item.unit_price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("delivery_items")
        .insert(deliveryItems);

      if (itemsError) throw itemsError;

      // Add to customer ledger
      const { error: ledgerError } = await supabase
        .from("customer_ledger")
        .insert({
          customer_id: customerId,
          transaction_date: format(deliveryDate, "yyyy-MM-dd"),
          transaction_type: "delivery",
          description: `Add-on Order: ${orderItems.map((i) => `${i.product_name} × ${i.quantity}`).join(", ")}`,
          debit_amount: totalAmount,
          reference_id: delivery.id,
        });

      if (ledgerError) throw ledgerError;

      toast.success("Add-on order created successfully!");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating add-on order:", error);
      toast.error("Failed to create order");
    } finally {
      setSaving(false);
    }
  };

  const handleGoToDeliveries = () => {
    onOpenChange(false);
    navigate(`/deliveries?customer=${customerId}`);
  };

  const selectedProductIds = new Set(orderItems.map((p) => p.product_id));

  const groupedProducts = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Quick Add-on Order
          </ResponsiveDialogTitle>
          <p className="text-sm text-muted-foreground">
            For: <span className="font-medium">{customerName}</span>
          </p>
        </ResponsiveDialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {/* Delivery Date */}
            <div className="space-y-2">
              <Label>Delivery Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !deliveryDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deliveryDate ? format(deliveryDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deliveryDate}
                    onSelect={(date) => date && setDeliveryDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Products Selection */}
            <div className="space-y-3">
              <Label>Select Products</Label>
              {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
                <div key={category} className="space-y-2">
                  <p className="text-xs uppercase text-muted-foreground font-medium">
                    {category}
                  </p>
                  <div className="space-y-2">
                    {categoryProducts.map((product) => {
                      const isSelected = selectedProductIds.has(product.id);
                      const selectedItem = orderItems.find(
                        (p) => p.product_id === product.id
                      );

                      return (
                        <Card
                          key={product.id}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <CardContent className="p-3">
                            <div
                              className="flex items-center justify-between"
                              onClick={() => handleProductToggle(product)}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox checked={isSelected} />
                                <div>
                                  <p className="font-medium text-sm">{product.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    ₹{product.base_price}/{product.unit}
                                  </p>
                                </div>
                              </div>

                              {isSelected && selectedItem && (
                                <div
                                  className="flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => updateQuantity(product.id, -0.5)}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    step="0.25"
                                    min="0.25"
                                    value={selectedItem.quantity}
                                    onChange={(e) =>
                                      setQuantity(
                                        product.id,
                                        parseFloat(e.target.value) || 0.25
                                      )
                                    }
                                    className="h-7 w-16 text-center"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => updateQuantity(product.id, 0.5)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            {orderItems.length > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-2">
                    {orderItems.map((item) => (
                      <div key={item.product_id} className="flex justify-between text-sm">
                        <span>
                          {item.product_name} × {item.quantity}
                        </span>
                        <span>₹{(item.unit_price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                      <span>Total</span>
                      <span className="text-primary">₹{totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <ResponsiveDialogFooter className="flex-shrink-0 gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleGoToDeliveries}>
            <Truck className="h-4 w-4 mr-2" />
            Go to Deliveries
          </Button>
          <Button
            onClick={handleSaveOrder}
            disabled={saving || orderItems.length === 0}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4 mr-2" />
            )}
            Add Order
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
