import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useCattleData, Cattle, CattleFormData } from "@/hooks/useCattleData";
import { CattlePageSkeleton } from "@/components/common/PageSkeletons";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { MilkHistoryDialog } from "@/components/production/MilkHistoryDialog";
import { CattlePedigreeDialog } from "@/components/cattle/CattlePedigreeDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Beef, Edit, Trash2, Loader2, Droplets, GitBranch } from "lucide-react";

const emptyFormData: CattleFormData = {
  tag_number: "",
  name: "",
  breed: "",
  cattle_type: "cow",
  date_of_birth: "",
  weight: "",
  status: "active",
  lactation_status: "dry",
  notes: "",
  sire_id: "",
  dam_id: "",
};

export default function CattlePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { cattle, isLoading, createCattle, updateCattle, deleteCattle, isCreating, isUpdating } = useCattleData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCattle, setSelectedCattle] = useState<Cattle | null>(null);
  const [formData, setFormData] = useState<CattleFormData>(emptyFormData);

  // Milk history dialog state
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyCattleId, setHistoryCattleId] = useState<string>("");
  const [historyCattleName, setHistoryCattleName] = useState<string>("");

  // Pedigree dialog state
  const [pedigreeDialogOpen, setPedigreeDialogOpen] = useState(false);
  const [pedigreeCattleId, setPedigreeCattleId] = useState<string>("");
  const [pedigreeCattleName, setPedigreeCattleName] = useState<string>("");

  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setDialogOpen(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  if (isLoading) {
    return <CattlePageSkeleton />;
  }

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
        sire_id: cattle.sire_id || "",
        dam_id: cattle.dam_id || "",
      });
    } else {
      setSelectedCattle(null);
      setFormData(emptyFormData);
    }
    setDialogOpen(true);
  };

  const handleOpenPedigree = (cattle: Cattle) => {
    setPedigreeCattleId(cattle.id);
    setPedigreeCattleName(`${cattle.tag_number}${cattle.name ? ` (${cattle.name})` : ""}`);
    setPedigreeDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.tag_number || !formData.breed) {
      return;
    }

    if (selectedCattle) {
      updateCattle({ id: selectedCattle.id, formData }, {
        onSuccess: () => setDialogOpen(false),
      });
    } else {
      createCattle(formData, {
        onSuccess: () => setDialogOpen(false),
      });
    }
  };

  const handleDelete = () => {
    if (!selectedCattle) return;
    deleteCattle(selectedCattle.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setSelectedCattle(null);
      },
    });
  };


  const handleOpenMilkHistory = (cattle: Cattle) => {
    setHistoryCattleId(cattle.id);
    setHistoryCattleName(`${cattle.tag_number}${cattle.name ? ` (${cattle.name})` : ""}`);
    setHistoryDialogOpen(true);
  };

  // Check if cattle has milk production history (is or was lactating)
  const canShowMilkHistory = (cattle: Cattle) => {
    return cattle.lactation_status === "lactating" || 
           cattle.lactation_status === "dry" || 
           cattle.lactation_status === "pregnant" ||
           cattle.lactation_status === "calving";
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
              handleOpenPedigree(item);
            }}
            title="View Pedigree"
          >
            <GitBranch className="h-4 w-4 text-primary" />
          </Button>
          {canShowMilkHistory(item) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenMilkHistory(item);
              }}
              title="View Milk History"
            >
              <Droplets className="h-4 w-4 text-info" />
            </Button>
          )}
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
        loading={isLoading}
        searchPlaceholder="Search by tag, name, breed..."
        emptyMessage="No cattle found. Add your first cattle to get started."
      />

      {/* Add/Edit Dialog */}
      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent className="max-w-2xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {selectedCattle ? "Edit Cattle" : "Add New Cattle"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {selectedCattle
                ? "Update cattle information"
                : "Enter details for the new cattle"}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="grid gap-4 py-4 overflow-y-auto max-h-[60vh] sm:max-h-none">
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

            {/* Pedigree Section */}
            <div className="border-t pt-4 mt-2">
              <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                <GitBranch className="h-4 w-4" />
                Pedigree (Parents)
              </Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sire_id">Sire (Father)</Label>
                  <Select
                    value={formData.sire_id}
                    onValueChange={(v) =>
                      setFormData({ ...formData, sire_id: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sire..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No sire recorded</SelectItem>
                      {cattle
                        .filter((c) => c.id !== selectedCattle?.id)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.tag_number} {c.name ? `(${c.name})` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dam_id">Dam (Mother)</Label>
                  <Select
                    value={formData.dam_id}
                    onValueChange={(v) =>
                      setFormData({ ...formData, dam_id: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select dam..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No dam recorded</SelectItem>
                      {cattle
                        .filter((c) => c.id !== selectedCattle?.id && c.cattle_type === "cow")
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.tag_number} {c.name ? `(${c.name})` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
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

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isCreating || isUpdating}>
              {(isCreating || isUpdating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedCattle ? "Update" : "Add"} Cattle
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

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

      {/* Milk History Dialog */}
      <MilkHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        mode="cattle"
        cattleId={historyCattleId}
        cattleName={historyCattleName}
      />

      {/* Pedigree Dialog */}
      <CattlePedigreeDialog
        open={pedigreeDialogOpen}
        onOpenChange={setPedigreeDialogOpen}
        cattleId={pedigreeCattleId}
        cattleName={pedigreeCattleName}
      />
    </div>
  );
}
