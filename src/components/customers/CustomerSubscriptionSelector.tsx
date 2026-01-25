import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, Minus, Milk, Loader2, ChevronDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  base_price: number;
}

interface DeliveryDays {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

type FrequencyType = "daily" | "alternate" | "weekly" | "custom";

export interface SubscriptionProduct {
  product_id: string;
  product_name: string;
  quantity: number;
  custom_price: number | null;
  unit: string;
  frequency: FrequencyType;
  delivery_days: DeliveryDays;
}

export interface CustomerSubscriptionData {
  products: SubscriptionProduct[];
  frequency: FrequencyType; // Global default (used for new products)
  delivery_days: DeliveryDays; // Global default
  auto_deliver: boolean;
}

interface CustomerSubscriptionSelectorProps {
  value: CustomerSubscriptionData;
  onChange: (data: CustomerSubscriptionData) => void;
}

const defaultDeliveryDays: DeliveryDays = {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: true,
  sunday: true,
};

const weekDays = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
] as const;

const getDeliveryDaysForFrequency = (frequency: FrequencyType): DeliveryDays => {
  if (frequency === "daily") {
    return { ...defaultDeliveryDays };
  } else if (frequency === "alternate") {
    return {
      monday: true,
      tuesday: false,
      wednesday: true,
      thursday: false,
      friday: true,
      saturday: false,
      sunday: true,
    };
  } else if (frequency === "weekly") {
    return {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: true,
    };
  }
  return { ...defaultDeliveryDays };
};

export function CustomerSubscriptionSelector({
  value,
  onChange,
}: CustomerSubscriptionSelectorProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
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
    const existing = value.products.find((p) => p.product_id === product.id);
    if (existing) {
      // Remove product
      onChange({
        ...value,
        products: value.products.filter((p) => p.product_id !== product.id),
      });
      setExpandedProducts((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    } else {
      // Add product with default frequency from global settings
      onChange({
        ...value,
        products: [
          ...value.products,
          {
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            custom_price: null,
            unit: product.unit,
            frequency: value.frequency,
            delivery_days: { ...value.delivery_days },
          },
        ],
      });
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    onChange({
      ...value,
      products: value.products.map((p) => {
        if (p.product_id === productId) {
          const newQty = Math.max(0.25, p.quantity + delta);
          return { ...p, quantity: newQty };
        }
        return p;
      }),
    });
  };

  const setQuantity = (productId: string, qty: number) => {
    onChange({
      ...value,
      products: value.products.map((p) => {
        if (p.product_id === productId) {
          return { ...p, quantity: Math.max(0.25, qty) };
        }
        return p;
      }),
    });
  };

  const updateProductFrequency = (productId: string, frequency: FrequencyType) => {
    onChange({
      ...value,
      products: value.products.map((p) => {
        if (p.product_id === productId) {
          return {
            ...p,
            frequency,
            delivery_days: getDeliveryDaysForFrequency(frequency),
          };
        }
        return p;
      }),
    });
  };

  const toggleProductDeliveryDay = (productId: string, day: keyof DeliveryDays) => {
    onChange({
      ...value,
      products: value.products.map((p) => {
        if (p.product_id === productId) {
          return {
            ...p,
            frequency: "custom" as FrequencyType,
            delivery_days: {
              ...p.delivery_days,
              [day]: !p.delivery_days[day],
            },
          };
        }
        return p;
      }),
    });
  };

  const handleGlobalFrequencyChange = (frequency: FrequencyType) => {
    const newDeliveryDays = getDeliveryDaysForFrequency(frequency);
    onChange({
      ...value,
      frequency,
      delivery_days: newDeliveryDays,
    });
  };

  const toggleGlobalDeliveryDay = (day: keyof DeliveryDays) => {
    onChange({
      ...value,
      delivery_days: {
        ...value.delivery_days,
        [day]: !value.delivery_days[day],
      },
    });
  };

  const toggleProductExpanded = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const selectedProductIds = new Set(value.products.map((p) => p.product_id));

  const groupedProducts = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalMonthlyValue = value.products.reduce((sum, p) => {
    const product = products.find((pr) => pr.id === p.product_id);
    const price = p.custom_price ?? product?.base_price ?? 0;
    const deliveryDaysCount = Object.values(p.delivery_days).filter(Boolean).length;
    const daysPerMonth = (deliveryDaysCount / 7) * 30;
    return sum + price * p.quantity * daysPerMonth;
  }, 0);

  const frequencyLabels: Record<FrequencyType, string> = {
    daily: "Daily",
    alternate: "Alternate",
    weekly: "Weekly",
    custom: "Custom",
  };

  return (
    <div className="space-y-4">
      {/* Global Default Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Default Schedule (for new products)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <Label className="text-xs w-20">Frequency</Label>
            <Select
              value={value.frequency}
              onValueChange={(v) => handleGlobalFrequencyChange(v as FrequencyType)}
            >
              <SelectTrigger className="h-8 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="alternate">Alternate Days</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="custom">Custom Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-1">
            {weekDays.map((day) => (
              <Badge
                key={day.key}
                variant={value.delivery_days[day.key] ? "default" : "outline"}
                className={cn(
                  "cursor-pointer text-xs transition-colors",
                  value.delivery_days[day.key]
                    ? "bg-primary hover:bg-primary/80"
                    : "hover:bg-muted"
                )}
                onClick={() => toggleGlobalDeliveryDay(day.key)}
              >
                {day.label}
              </Badge>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <p className="text-sm font-medium">Auto-mark as Delivered</p>
              <p className="text-xs text-muted-foreground">
                Automatically mark deliveries as completed
              </p>
            </div>
            <Checkbox
              checked={value.auto_deliver}
              onCheckedChange={(checked) =>
                onChange({ ...value, auto_deliver: !!checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Subscription Products */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Milk className="h-4 w-4" />
            Select Products
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
            <div key={category} className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">
                {category}
              </Label>
              <div className="space-y-2">
                {categoryProducts.map((product) => {
                  const isSelected = selectedProductIds.has(product.id);
                  const selectedProduct = value.products.find(
                    (p) => p.product_id === product.id
                  );
                  const isExpanded = expandedProducts.has(product.id);

                  return (
                    <div
                      key={product.id}
                      className={cn(
                        "rounded-lg border transition-colors",
                        isSelected
                          ? "bg-primary/5 border-primary"
                          : "hover:bg-muted/50"
                      )}
                    >
                      {/* Main Product Row */}
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer"
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

                        {isSelected && selectedProduct && (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {/* Quantity Controls */}
                            <div className="flex items-center gap-1">
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
                                value={selectedProduct.quantity}
                                onChange={(e) =>
                                  setQuantity(product.id, parseFloat(e.target.value) || 0.25)
                                }
                                className="h-7 w-14 text-center"
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

                            {/* Expand Schedule Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => toggleProductExpanded(product.id)}
                            >
                              <Calendar className="h-3 w-3 mr-1" />
                              <span className="text-xs">{frequencyLabels[selectedProduct.frequency]}</span>
                              <ChevronDown className={cn("h-3 w-3 ml-1 transition-transform", isExpanded && "rotate-180")} />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Individual Product Schedule */}
                      {isSelected && selectedProduct && isExpanded && (
                        <div
                          className="px-3 pb-3 pt-1 border-t bg-muted/30 space-y-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-3">
                            <Label className="text-xs w-16">Schedule</Label>
                            <Select
                              value={selectedProduct.frequency}
                              onValueChange={(v) => updateProductFrequency(product.id, v as FrequencyType)}
                            >
                              <SelectTrigger className="h-7 flex-1 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="alternate">Alternate Days</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="custom">Custom Days</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {weekDays.map((day) => (
                              <Badge
                                key={day.key}
                                variant={selectedProduct.delivery_days[day.key] ? "default" : "outline"}
                                className={cn(
                                  "cursor-pointer text-xs transition-colors",
                                  selectedProduct.delivery_days[day.key]
                                    ? "bg-primary hover:bg-primary/80"
                                    : "hover:bg-muted"
                                )}
                                onClick={() => toggleProductDeliveryDay(product.id, day.key)}
                              >
                                {day.label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {products.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No products available. Add products first.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {value.products.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">
                  {value.products.length} product{value.products.length !== 1 ? "s" : ""} selected
                </p>
                <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                  {value.products.map((p) => (
                    <div key={p.product_id} className="flex items-center gap-2">
                      <span>{p.product_name}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {frequencyLabels[p.frequency]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">
                  ≈ ₹{Math.round(totalMonthlyValue).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Est. monthly value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export const defaultSubscriptionData: CustomerSubscriptionData = {
  products: [],
  frequency: "daily",
  delivery_days: defaultDeliveryDays,
  auto_deliver: true,
};
