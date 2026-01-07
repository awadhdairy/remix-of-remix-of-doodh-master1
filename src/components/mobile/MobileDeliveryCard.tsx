import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  Phone, 
  ChevronDown, 
  ChevronUp,
  Package
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DeliveryItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface MobileDeliveryCardProps {
  customerName: string;
  address: string;
  phone?: string;
  area?: string;
  status: string;
  items?: DeliveryItem[];
  bottlesPending?: number;
  onStatusChange?: (status: string) => void;
  onCall?: () => void;
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: "bg-warning", icon: Clock, label: "Pending" },
  delivered: { color: "bg-success", icon: CheckCircle, label: "Delivered" },
  missed: { color: "bg-destructive", icon: XCircle, label: "Missed" },
  partial: { color: "bg-role-delivery", icon: Package, label: "Partial" },
};

export function MobileDeliveryCard({
  customerName,
  address,
  phone,
  area,
  status,
  items = [],
  bottlesPending = 0,
  onStatusChange,
  onCall,
}: MobileDeliveryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const statusInfo = statusConfig[status] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Main Card Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{customerName}</h3>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{address || area || "No address"}</span>
              </div>
              {bottlesPending > 0 && (
                <div className="flex items-center gap-1 text-sm text-orange-600 mt-1">
                  <Package className="h-3.5 w-3.5" />
                  <span>{bottlesPending} bottles pending</span>
                </div>
              )}
            </div>
            <Badge className={cn(statusInfo.color, "text-white shrink-0")}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 mt-4">
            {phone && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => window.open(`tel:${phone}`, '_self')}
              >
                <Phone className="h-4 w-4 mr-2" />
                Call
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Details
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="border-t bg-muted/30 p-4 space-y-4">
            {/* Items */}
            {items.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Items to Deliver</p>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.product_name}</span>
                      <span className="font-medium">{item.quantity} × ₹{item.unit_price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status Update Buttons */}
            {onStatusChange && status === "pending" && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => onStatusChange("delivered")}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Delivered
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-orange-600 border-orange-600 hover:bg-orange-50"
                  onClick={() => onStatusChange("partial")}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Partial
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  onClick={() => onStatusChange("missed")}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Missed
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
