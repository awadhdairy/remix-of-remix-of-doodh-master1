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
import { Settings as SettingsIcon, Building2, User, Bell, Shield, Loader2, Save } from "lucide-react";

interface DairySettings {
  id: string;
  dairy_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  invoice_prefix: string;
  financial_year_start: number;
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

    // Fetch user profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
      }
    }

    setLoading(false);
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
              {dairySettings && (
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

                  <Button onClick={handleSaveDairySettings} disabled={saving} className="gap-2">
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                </>
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
