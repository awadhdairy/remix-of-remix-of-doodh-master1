import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Building2, User, Bell, Shield, Loader2, Save, KeyRound } from "lucide-react";

interface DairySettings {
  id: string;
  dairy_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  invoice_prefix: string;
  financial_year_start: number;
  upi_handle: string | null;
}

interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
}

export default function SettingsPage() {
  const [dairySettings, setDairySettings] = useState<DairySettings | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);

    // Fetch dairy settings
    const { data: settingsData } = await supabase
      .from("dairy_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (settingsData) {
      setDairySettings(settingsData);
    }

    // Fetch user profile using safe view (excludes pin_hash)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profileData } = await supabase
        .from("profiles_safe")
        .select("id, full_name, phone, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
      }
    }

    setLoading(false);
  };

  const handleCreateDefaultSettings = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("dairy_settings")
      .insert({ dairy_name: "Awadh Dairy" })
      .select()
      .single();

    setSaving(false);

    if (error) {
      toast({
        title: "Error creating settings",
        description: error.message,
        variant: "destructive",
      });
    } else if (data) {
      setDairySettings(data);
      toast({
        title: "Settings created",
        description: "Default dairy settings have been created",
      });
    }
  };

  const handleSaveDairySettings = async () => {
    if (!dairySettings) return;

    setSaving(true);
    const { error } = await supabase
      .from("dairy_settings")
      .update({
        dairy_name: dairySettings.dairy_name,
        address: dairySettings.address,
        phone: dairySettings.phone,
        email: dairySettings.email,
        invoice_prefix: dairySettings.invoice_prefix,
      })
      .eq("id", dairySettings.id);

    setSaving(false);

    if (error) {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Settings saved",
        description: "Your dairy settings have been updated",
      });
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile saved",
        description: "Your profile has been updated",
      });
    }
  };

  const handleChangePin = async () => {
    if (!currentPin || !newPin || !confirmPin) {
      toast({
        title: "Missing fields",
        description: "Please fill in all PIN fields",
        variant: "destructive",
      });
      return;
    }

    if (!/^\d{6}$/.test(newPin)) {
      toast({
        title: "Invalid PIN",
        description: "New PIN must be exactly 6 digits",
        variant: "destructive",
      });
      return;
    }

    if (newPin !== confirmPin) {
      toast({
        title: "PIN mismatch",
        description: "New PIN and confirmation do not match",
        variant: "destructive",
      });
      return;
    }

    setChangingPin(true);
    try {
      const response = await supabase.functions.invoke("change-pin", {
        body: {
          currentPin,
          newPin,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to change PIN");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: "PIN changed",
        description: "Your login PIN has been updated successfully",
      });
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (error: any) {
      toast({
        title: "Error changing PIN",
        description: error.message || "Failed to change PIN",
        variant: "destructive",
      });
    } finally {
      setChangingPin(false);
    }
  };

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
        title="Settings"
        description="Manage your dairy and account settings"
        icon={SettingsIcon}
      />

      <Tabs defaultValue="dairy" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dairy" className="gap-2">
            <Building2 className="h-4 w-4" /> Dairy Info
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <KeyRound className="h-4 w-4" /> Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" /> Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dairy">
          <Card>
            <CardHeader>
              <CardTitle>Dairy Information</CardTitle>
              <CardDescription>
                Update your dairy business details. These will appear on invoices and reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dairySettings ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dairy_name">Dairy Name</Label>
                      <Input
                        id="dairy_name"
                        value={dairySettings.dairy_name}
                        onChange={(e) =>
                          setDairySettings({ ...dairySettings, dairy_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoice_prefix">Invoice Prefix</Label>
                      <Input
                        id="invoice_prefix"
                        value={dairySettings.invoice_prefix}
                        onChange={(e) =>
                          setDairySettings({ ...dairySettings, invoice_prefix: e.target.value })
                        }
                        placeholder="INV"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dairy_phone">Phone</Label>
                      <Input
                        id="dairy_phone"
                        value={dairySettings.phone || ""}
                        onChange={(e) =>
                          setDairySettings({ ...dairySettings, phone: e.target.value })
                        }
                        placeholder="+91 98765 43210"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dairy_email">Email</Label>
                      <Input
                        id="dairy_email"
                        type="email"
                        value={dairySettings.email || ""}
                        onChange={(e) =>
                          setDairySettings({ ...dairySettings, email: e.target.value })
                        }
                        placeholder="dairy@example.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dairy_address">Address</Label>
                    <Textarea
                      id="dairy_address"
                      value={dairySettings.address || ""}
                      onChange={(e) =>
                        setDairySettings({ ...dairySettings, address: e.target.value })
                      }
                      placeholder="Full address"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="upi_handle">UPI Handle (for Payments)</Label>
                    <Input
                      id="upi_handle"
                      value={dairySettings.upi_handle || ""}
                      onChange={(e) =>
                        setDairySettings({ ...dairySettings, upi_handle: e.target.value })
                      }
                      placeholder="yourname@upi or 9876543210@paytm"
                    />
                    <p className="text-xs text-muted-foreground">
                      This UPI ID will appear on invoices. Customers can tap to pay directly.
                    </p>
                  </div>

                  <Button onClick={handleSaveDairySettings} disabled={saving} className="gap-2">
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Dairy Settings Found</h3>
                  <p className="text-muted-foreground max-w-sm mb-4">
                    Click below to create default settings for your dairy
                  </p>
                  <Button onClick={handleCreateDefaultSettings} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create Default Settings
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        value={profile.full_name}
                        onChange={(e) =>
                          setProfile({ ...profile, full_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile_phone">Phone</Label>
                      <Input
                        id="profile_phone"
                        value={profile.phone || ""}
                        onChange={(e) =>
                          setProfile({ ...profile, phone: e.target.value })
                        }
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Input value={profile.role.replace("_", " ")} disabled className="capitalize" />
                    <p className="text-xs text-muted-foreground">
                      Your role determines what actions you can perform in the system
                    </p>
                  </div>

                  <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Profile
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Change Login PIN
              </CardTitle>
              <CardDescription>
                Update your 6-digit PIN used for logging in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="current_pin">Current PIN</Label>
                  <Input
                    id="current_pin"
                    type="password"
                    placeholder="••••••"
                    maxLength={6}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new_pin">New PIN</Label>
                  <Input
                    id="new_pin"
                    type="password"
                    placeholder="••••••"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_pin">Confirm New PIN</Label>
                  <Input
                    id="confirm_pin"
                    type="password"
                    placeholder="••••••"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                PIN must be exactly 6 digits. This will be used for your next login.
              </p>
              <Button onClick={handleChangePin} disabled={changingPin} className="gap-2">
                {changingPin ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                Change PIN
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure how you receive alerts and reminders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Coming Soon</h3>
                <p className="text-muted-foreground max-w-sm">
                  SMS and WhatsApp notification settings will be available in a future update
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
