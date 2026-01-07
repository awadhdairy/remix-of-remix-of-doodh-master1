import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Droplets, 
  Calendar, 
  Weight, 
  ChevronRight,
  Stethoscope,
  Baby
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface MobileCattleCardProps {
  tagNumber: string;
  name?: string;
  breed: string;
  status: string;
  lactationStatus?: string;
  lastProduction?: number;
  weight?: number;
  expectedCalving?: string;
  onViewDetails?: () => void;
  onAddProduction?: () => void;
  onAddHealth?: () => void;
}

const statusColors: Record<string, string> = {
  active: "bg-success",
  dry: "bg-warning",
  sold: "bg-status-inactive",
  deceased: "bg-destructive",
};

const lactationColors: Record<string, string> = {
  lactating: "bg-info",
  dry: "bg-warning",
  pregnant: "bg-breeding-pregnancy",
  calving: "bg-breeding-heat",
};

export function MobileCattleCard({
  tagNumber,
  name,
  breed,
  status,
  lactationStatus,
  lastProduction,
  weight,
  expectedCalving,
  onViewDetails,
  onAddProduction,
  onAddHealth,
}: MobileCattleCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">{tagNumber}</h3>
              {name && <span className="text-muted-foreground">({name})</span>}
            </div>
            <p className="text-sm text-muted-foreground">{breed}</p>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <Badge className={cn(statusColors[status] || "bg-gray-500", "text-white")}>
              {status}
            </Badge>
            {lactationStatus && (
              <Badge variant="outline" className={cn("text-xs", lactationColors[lactationStatus] ? `border-${lactationStatus}` : "")}>
                {lactationStatus}
              </Badge>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {lastProduction !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Droplets className="h-4 w-4 text-info" />
              <span>{lastProduction}L</span>
            </div>
          )}
          {weight && (
            <div className="flex items-center gap-2 text-sm">
              <Weight className="h-4 w-4 text-success" />
              <span>{weight}kg</span>
            </div>
          )}
          {expectedCalving && (
            <div className="flex items-center gap-2 text-sm">
              <Baby className="h-4 w-4 text-breeding-heat" />
              <span>{format(new Date(expectedCalving), "dd MMM")}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          {onAddProduction && lactationStatus === "lactating" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onAddProduction}
            >
              <Droplets className="h-4 w-4 mr-2" />
              Add Milk
            </Button>
          )}
          {onAddHealth && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onAddHealth}
            >
              <Stethoscope className="h-4 w-4 mr-2" />
              Health
            </Button>
          )}
          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={onViewDetails}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
