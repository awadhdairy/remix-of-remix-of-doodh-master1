import { useState, useEffect } from "react";
import { externalSupabase as supabase, invokeExternalFunction } from "@/lib/external-supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  MessageCircle, 
  Send, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Plus, 
  Trash2,
  Info,
  Bell
} from "lucide-react";

interface TelegramConfig {
  id: string;
  chat_id: string;
  chat_name: string | null;
  is_active: boolean;
  notify_production: boolean;
  notify_procurement: boolean;
  notify_deliveries: boolean;
  notify_health_alerts: boolean;
  notify_inventory_alerts: boolean;
  notify_payments: boolean;
  notify_daily_summary: boolean;
  large_payment_threshold: number;
}

export function TelegramSettings() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<TelegramConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // New config form
  const [newChatId, setNewChatId] = useState("");
  const [newChatName, setNewChatName] = useState("");

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("telegram_config")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching telegram configs:", error);
    } else {
      setConfigs(data || []);
    }
    setLoading(false);
  };

  const handleAddConfig = async () => {
    if (!newChatId.trim()) {
      toast({
        title: "Chat ID Required",
        description: "Please enter a Telegram Chat ID",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("telegram_config")
      .insert({
        chat_id: newChatId.trim(),
        chat_name: newChatName.trim() || null,
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setConfigs([data, ...configs]);
      setNewChatId("");
      setNewChatName("");
      setShowAddForm(false);
      toast({
        title: "Success",
        description: "Telegram configuration added",
      });
    }
  };

  const handleUpdateConfig = async (id: string, updates: Partial<TelegramConfig>) => {
    const { error } = await supabase
      .from("telegram_config")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setConfigs(configs.map(c => c.id === id ? { ...c, ...updates } : c));
    }
  };

  const handleDeleteConfig = async (id: string) => {
    const { error } = await supabase
      .from("telegram_config")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setConfigs(configs.filter(c => c.id !== id));
      toast({
        title: "Deleted",
        description: "Telegram configuration removed",
      });
    }
  };

  const handleTestConnection = async (config: TelegramConfig) => {
    setTesting(config.id);
    try {
      const response = await invokeExternalFunction<{ success: boolean; error?: string }>(
        "send-telegram",
        {
          chat_id: config.chat_id,
          message: `✅ <b>Test Message from Awadh Dairy</b>\n\nYour Telegram notifications are configured correctly!\n\n<i>Chat: ${config.chat_name || config.chat_id}</i>`,
          log_to_db: true,
        }
      );

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message || "Failed to send test message");
      }

      toast({
        title: "Success!",
        description: "Test message sent to Telegram",
      });
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message || "Could not send test message",
        variant: "destructive",
      });
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-info/10 p-2">
                <MessageCircle className="h-5 w-5 text-info" />
              </div>
              <div>
                <CardTitle>Telegram Notifications</CardTitle>
                <CardDescription>
                  Receive instant alerts on Telegram for dairy operations
                </CardDescription>
              </div>
            </div>
            <Badge variant={configs.some(c => c.is_active) ? "default" : "secondary"}>
              {configs.filter(c => c.is_active).length} Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <div className="flex gap-2">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium">How to get your Chat ID:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Open Telegram and search for <code className="bg-background px-1 rounded">@userinfobot</code></li>
                  <li>Start the bot and it will show your Chat ID</li>
                  <li>For group chats, add the bot to your group first</li>
                  <li>Enter the Chat ID below and test the connection</li>
                </ol>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add New Config */}
      {!showAddForm ? (
        <Button onClick={() => setShowAddForm(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Telegram Chat
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add New Chat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new_chat_id">Chat ID *</Label>
                <Input
                  id="new_chat_id"
                  value={newChatId}
                  onChange={(e) => setNewChatId(e.target.value)}
                  placeholder="123456789 or -1001234567890"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_chat_name">Display Name (optional)</Label>
                <Input
                  id="new_chat_name"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  placeholder="e.g., Admin Group"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddConfig} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Chat
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Configs */}
      {configs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Telegram Chats Configured</h3>
            <p className="text-muted-foreground max-w-sm mb-4">
              Add a Telegram chat to start receiving notifications
            </p>
          </CardContent>
        </Card>
      ) : (
        configs.map((config) => (
          <Card key={config.id} className={!config.is_active ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-2 ${config.is_active ? "bg-success/10" : "bg-muted"}`}>
                    {config.is_active ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {config.chat_name || `Chat ${config.chat_id}`}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs">
                      ID: {config.chat_id}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.is_active}
                    onCheckedChange={(checked) => handleUpdateConfig(config.id, { is_active: checked })}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection(config)}
                    disabled={testing === config.id}
                  >
                    {testing === config.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span className="ml-2 hidden sm:inline">Test</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteConfig(config.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Separator />
              
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Bell className="h-4 w-4" /> Notification Preferences
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor={`daily-${config.id}`} className="cursor-pointer text-sm">
                      Daily Summary (8 PM)
                    </Label>
                    <Switch
                      id={`daily-${config.id}`}
                      checked={config.notify_daily_summary}
                      onCheckedChange={(checked) => handleUpdateConfig(config.id, { notify_daily_summary: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor={`production-${config.id}`} className="cursor-pointer text-sm">
                      Production Alerts
                    </Label>
                    <Switch
                      id={`production-${config.id}`}
                      checked={config.notify_production}
                      onCheckedChange={(checked) => handleUpdateConfig(config.id, { notify_production: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor={`procurement-${config.id}`} className="cursor-pointer text-sm">
                      Procurement Alerts
                    </Label>
                    <Switch
                      id={`procurement-${config.id}`}
                      checked={config.notify_procurement}
                      onCheckedChange={(checked) => handleUpdateConfig(config.id, { notify_procurement: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor={`deliveries-${config.id}`} className="cursor-pointer text-sm">
                      Delivery Status
                    </Label>
                    <Switch
                      id={`deliveries-${config.id}`}
                      checked={config.notify_deliveries}
                      onCheckedChange={(checked) => handleUpdateConfig(config.id, { notify_deliveries: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor={`health-${config.id}`} className="cursor-pointer text-sm">
                      Health Alerts
                    </Label>
                    <Switch
                      id={`health-${config.id}`}
                      checked={config.notify_health_alerts}
                      onCheckedChange={(checked) => handleUpdateConfig(config.id, { notify_health_alerts: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor={`inventory-${config.id}`} className="cursor-pointer text-sm">
                      Low Inventory
                    </Label>
                    <Switch
                      id={`inventory-${config.id}`}
                      checked={config.notify_inventory_alerts}
                      onCheckedChange={(checked) => handleUpdateConfig(config.id, { notify_inventory_alerts: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor={`payments-${config.id}`} className="cursor-pointer text-sm">
                      Payment Received
                    </Label>
                    <Switch
                      id={`payments-${config.id}`}
                      checked={config.notify_payments}
                      onCheckedChange={(checked) => handleUpdateConfig(config.id, { notify_payments: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2 lg:col-span-2">
                    <div>
                      <Label htmlFor={`threshold-${config.id}`} className="text-sm">
                        Large Payment Alert (₹)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Get notified for payments above this amount
                      </p>
                    </div>
                    <Input
                      id={`threshold-${config.id}`}
                      type="number"
                      className="w-28"
                      value={config.large_payment_threshold}
                      onChange={(e) => handleUpdateConfig(config.id, { 
                        large_payment_threshold: Number(e.target.value) || 10000 
                      })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
