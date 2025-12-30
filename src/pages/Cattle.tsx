import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Beef, Edit, Trash2, Eye, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Cattle {
  id: string;
  tag_number: string;
  name: string | null;
  breed: string;
  cattle_type: string;
  date_of_birth: string | null;
  status: string;
  lactation_status: string;
  weight: number | null;
  created_at: string;
}

const emptyFormData = {
  tag_number: "",
  name: "",
  breed: "",
  cattle_type: "cow",
  date_of_birth: "",
  weight: "",
  status: "active",
  lactation_status: "dry",
  notes: "",
};

export default function CattlePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cattle, setCattle] = useState<Cattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCattle, setSelectedCattle] = useState<Cattle | null>(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCattle();
    if (searchParams.get("action") === "add") {
      setDialogOpen(true);
      setSearchParams({});
    }
  }, [searchParams]);

  const fetchCattle = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cattle")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error fetching cattle",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setCattle(data || []);
    }
    setLoading(false);
  };

  const handleOpenDialog = (cattle?: Cattle) => {
    if (cattle) {
      setSelectedCattle(cattle);
      setFormData({
        tag_number: cattle.tag_number,
        name: cattle.name || "",
        breed: cattle.breed,
        cattle_type: cattle.cattle_type,
        date_of_birth: cattle.date_of_birth || "",
        weight: cattle.weight?.toString() || "",
        status: cattle.status,
        lactation_status: cattle.lactation_status,
        notes: "",
      });
    } else {
      setSelectedCattle(null);
      setFormData(emptyFormData);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.tag_number || !formData.breed) {
      toast({
        title: "Validation Error",
        description: "Tag number and breed are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const payload = {
      tag_number: formData.tag_number,
      name: formData.name || null,
      breed: formData.breed,
      cattle_type: formData.cattle_type,
      date_of_birth: formData.date_of_birth || null,
      weight: formData.weight ? parseFloat(formData.weight) : null,
      status: formData.status as "active" | "sold" | "deceased" | "dry",
      lactation_status: formData.lactation_status as "lactating" | "dry" | "pregnant" | "calving",
      notes: formData.notes || null,
    };

    const { error } = selectedCattle
      ? await supabase.from("cattle").update(payload).eq("id", selectedCattle.id)
      : await supabase.from("cattle").insert(payload);

    setSaving(false);

    if (error) {
      toast({
        title: "Error saving cattle",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: selectedCattle ? "Cattle updated" : "Cattle added",
        description: `${formData.tag_number} has been saved successfully`,
      });
      setDialogOpen(false);
      fetchCattle();
    }
  };

  const handleDelete = async () => {
    if (!selectedCattle) return;

    const { error } = await supabase.from("cattle").delete().eq("id", selectedCattle.id);

    if (error) {
      toast({
        title: "Error deleting cattle",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Cattle deleted",
        description: `${selectedCattle.tag_number} has been removed`,
      });
      setDeleteDialogOpen(false);
      setSelectedCattle(null);
      fetchCattle();
    }
  };

  const columns = [
    {
      key: "tag_number",
      header: "Tag #",
      render: (item: Cattle) => (
        <span className="font-semibold text-primary">{item.tag_number}</span>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (item: Cattle) => item.name || "-",
    },
    {
      key: "breed",
      header: "Breed",
    },
    {
      key: "cattle_type",
      header: "Type",
      render: (item: Cattle) => (
        <span className="capitalize">{item.cattle_type}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: Cattle) => <StatusBadge status={item.status} />,
    },
    {
      key: "lactation_status",
      header: "Lactation",
      render: (item: Cattle) => <StatusBadge status={item.lactation_status} />,
    },
    {
      key: "weight",
      header: "Weight (kg)",
      render: (item: Cattle) => item.weight ? `${item.weight} kg` : "-",
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: Cattle) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDialog(item);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCattle(item);
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cattle Management"
        description="Manage your dairy cattle inventory"
        icon={Beef}
        action={{
          label: "Add Cattle",
          onClick: () => handleOpenDialog(),
        }}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{cattle.length}</div>
            <p className="text-sm text-muted-foreground">Total Cattle</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">
              {cattle.filter((c) => c.lactation_status === "lactating").length}
            </div>
            <p className="text-sm text-muted-foreground">Lactating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-info">
              {cattle.filter((c) => c.lactation_status === "pregnant").length}
            </div>
            <p className="text-sm text-muted-foreground">Pregnant</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">
              {cattle.filter((c) => c.lactation_status === "dry").length}
            </div>
            <p className="text-sm text-muted-foreground">Dry</p>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={cattle}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search by tag, name, breed..."
        emptyMessage="No cattle found. Add your first cattle to get started."
      />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCattle ? "Edit Cattle" : "Add New Cattle"}
            </DialogTitle>
            <DialogDescription>
              {selectedCattle
                ? "Update cattle information"
                : "Enter details for the new cattle"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tag_number">Tag Number *</Label>
                <Input
                  id="tag_number"
                  value={formData.tag_number}
                  onChange={(e) =>
                    setFormData({ ...formData, tag_number: e.target.value })
                  }
                  placeholder="e.g., C001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Lakshmi"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="breed">Breed *</Label>
                <Input
                  id="breed"
                  value={formData.breed}
                  onChange={(e) =>
                    setFormData({ ...formData, breed: e.target.value })
                  }
                  placeholder="e.g., Holstein, Jersey"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cattle_type">Type</Label>
                <Select
                  value={formData.cattle_type}
                  onValueChange={(v) =>
                    setFormData({ ...formData, cattle_type: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cow">Cow</SelectItem>
                    <SelectItem value="buffalo">Buffalo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) =>
                    setFormData({ ...formData, date_of_birth: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  value={formData.weight}
                  onChange={(e) =>
                    setFormData({ ...formData, weight: e.target.value })
                  }
                  placeholder="e.g., 450"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) =>
                    setFormData({ ...formData, status: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="dry">Dry</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="deceased">Deceased</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lactation_status">Lactation Status</Label>
                <Select
                  value={formData.lactation_status}
                  onValueChange={(v) =>
                    setFormData({ ...formData, lactation_status: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lactating">Lactating</SelectItem>
                    <SelectItem value="dry">Dry</SelectItem>
                    <SelectItem value="pregnant">Pregnant</SelectItem>
                    <SelectItem value="calving">Calving</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedCattle ? "Update" : "Add"} Cattle
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Cattle"
        description={`Are you sure you want to delete ${selectedCattle?.tag_number}? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
}
