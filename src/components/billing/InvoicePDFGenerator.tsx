import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { numberToIndianWords } from "@/lib/numberToWords";
import { logger } from "@/lib/logger";

interface DairySettings {
  dairy_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  invoice_prefix: string;
  logo_url: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  area: string | null;
}

interface DeliveryItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  delivery_date: string;
  unit: string;
}

interface DeliveryQueryResult {
  delivery_date: string;
  delivery_items: Array<{
    quantity: number;
    unit_price: number;
    total_amount: number;
    product: { name: string; unit: string } | null;
  }> | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  billing_period_start: string;
  billing_period_end: string;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  final_amount: number;
  paid_amount: number;
  payment_status: string;
  due_date: string | null;
  created_at: string;
  notes?: string | null;
  customer?: {
    id: string;
    name: string;
  };
}

interface InvoicePDFGeneratorProps {
  invoice: Invoice;
  onGenerated?: () => void;
}

// Helper to load image as base64
const loadImageAsBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
};

export function InvoicePDFGenerator({ invoice, onGenerated }: InvoicePDFGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // Preload logo
  useEffect(() => {
    loadImageAsBase64("/images/awadh-dairy-logo.png")
      .then(setLogoBase64)
      .catch(() => setLogoBase64(null));
  }, []);

  const generatePDF = async (action: "download" | "preview" = "download") => {
    setGenerating(true);

    try {
      // Fetch dairy settings
      const { data: settingsData } = await supabase
        .from("dairy_settings")
        .select("*")
        .limit(1)
        .single();

      const settings: DairySettings = settingsData || {
        dairy_name: "Awadh Dairy",
        address: "Lucknow, Uttar Pradesh, India",
        phone: "+91 78977 16792",
        email: "contact@awadhdairy.com",
        currency: "INR",
        invoice_prefix: "INV",
        logo_url: null,
      };

      // Fetch customer details
      const { data: customerData } = await supabase
        .from("customers")
        .select("*")
        .eq("id", invoice.customer_id)
        .single();

      const customer: Customer = customerData || {
        id: invoice.customer_id,
        name: invoice.customer?.name || "Customer",
        phone: null,
        email: null,
        address: null,
        area: null,
      };

      // Fetch delivery items for this billing period
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select(`
          delivery_date,
          delivery_items (
            quantity,
            unit_price,
            total_amount,
            product:product_id (name, unit)
          )
        `)
        .eq("customer_id", invoice.customer_id)
        .gte("delivery_date", invoice.billing_period_start)
        .lte("delivery_date", invoice.billing_period_end)
        .eq("status", "delivered");

      // Flatten delivery items
      const items: DeliveryItem[] = [];
      const typedDeliveries = (deliveries || []) as DeliveryQueryResult[];
      typedDeliveries.forEach((delivery) => {
        (delivery.delivery_items || []).forEach((item) => {
          items.push({
            product_name: item.product?.name || "Product",
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_amount: item.total_amount,
            delivery_date: delivery.delivery_date,
            unit: item.product?.unit || "unit",
          });
        });
      });

      // Create PDF
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;

      // Modern color palette
      const primaryColor: [number, number, number] = [45, 80, 22]; // Deep forest green
      const accentColor: [number, number, number] = [139, 90, 43]; // Warm brown (matches logo)
      const goldColor: [number, number, number] = [180, 150, 80]; // Gold accent
      const darkText: [number, number, number] = [30, 30, 30];
      const grayText: [number, number, number] = [100, 100, 100];
      const lightBg: [number, number, number] = [248, 248, 248];
      const borderColor: [number, number, number] = [220, 220, 220];

      // === WATERMARK - Draw first (behind everything) ===
      if (logoBase64) {
        const watermarkSize = 120;
        const watermarkX = (pageWidth - watermarkSize) / 2;
        const watermarkY = (pageHeight - watermarkSize) / 2;
        
        // Add logo as faded watermark
        doc.saveGraphicsState();
        doc.setGState(doc.GState({ opacity: 0.06 }));
        doc.addImage(logoBase64, "PNG", watermarkX, watermarkY, watermarkSize, watermarkSize);
        doc.restoreGraphicsState();
      }

      // === HEADER SECTION ===
      let yPos = margin;

      // Top decorative border
      doc.setFillColor(...accentColor);
      doc.rect(0, 0, pageWidth, 5, "F");

      // Logo and Company Info
      if (logoBase64) {
        doc.addImage(logoBase64, "PNG", margin, yPos + 3, 35, 35);
      }

      // Company details - right of logo
      const companyX = logoBase64 ? margin + 42 : margin;
      
      doc.setTextColor(...primaryColor);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text(settings.dairy_name.toUpperCase(), companyX, yPos + 14);
      
      doc.setFontSize(10);
      doc.setTextColor(...grayText);
      doc.setFont("helvetica", "normal");
      doc.text("Premium Quality Fresh Dairy Products", companyX, yPos + 22);
      
      doc.setFontSize(8);
      const addressLine = settings.address || "Lucknow, Uttar Pradesh, India";
      doc.text(addressLine, companyX, yPos + 29);
      
      const contactLine = `Phone: ${settings.phone || "+91 78977 16792"} | Email: contact@awadhdairy.com`;
      doc.text(contactLine, companyX, yPos + 35);

      // INVOICE badge - Right side
      const badgeWidth = 55;
      const badgeX = pageWidth - margin - badgeWidth;
      
      doc.setFillColor(...primaryColor);
      doc.roundedRect(badgeX, yPos + 5, badgeWidth, 32, 2, 2, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("TAX INVOICE", badgeX + badgeWidth / 2, yPos + 16, { align: "center" });
      
      doc.setFontSize(11);
      doc.text(invoice.invoice_number, badgeX + badgeWidth / 2, yPos + 25, { align: "center" });
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(format(new Date(invoice.created_at), "dd MMM yyyy"), badgeX + badgeWidth / 2, yPos + 32, { align: "center" });

      yPos += 48;

      // Separator line with gold accent
      doc.setDrawColor(...goldColor);
      doc.setLineWidth(1);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      
      yPos += 10;

      // === BILLING INFORMATION - Two Column Layout ===
      const colWidth = (pageWidth - margin * 2 - 20) / 2;

      // Bill To Box
      doc.setFillColor(...lightBg);
      doc.setDrawColor(...borderColor);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, yPos, colWidth, 45, 2, 2, "FD");
      
      doc.setTextColor(...accentColor);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("BILL TO", margin + 8, yPos + 10);
      
      doc.setDrawColor(...goldColor);
      doc.setLineWidth(0.5);
      doc.line(margin + 8, yPos + 12, margin + 35, yPos + 12);
      
      doc.setTextColor(...darkText);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(customer.name, margin + 8, yPos + 22);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...grayText);
      let customerInfoY = yPos + 28;
      
      if (customer.address) {
        const addressLines = doc.splitTextToSize(customer.address, colWidth - 16);
        doc.text(addressLines, margin + 8, customerInfoY);
        customerInfoY += addressLines.length * 4;
      }
      if (customer.area) {
        doc.text(`Area: ${customer.area}`, margin + 8, customerInfoY);
        customerInfoY += 4;
      }
      if (customer.phone) {
        doc.text(`Ph: ${customer.phone}`, margin + 8, customerInfoY);
      }

      // Invoice Details Box
      const rightColX = margin + colWidth + 20;
      doc.setFillColor(...lightBg);
      doc.setDrawColor(...borderColor);
      doc.roundedRect(rightColX, yPos, colWidth, 45, 2, 2, "FD");
      
      doc.setTextColor(...accentColor);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("INVOICE DETAILS", rightColX + 8, yPos + 10);
      
      doc.setDrawColor(...goldColor);
      doc.line(rightColX + 8, yPos + 12, rightColX + 50, yPos + 12);

      // Invoice detail rows
      doc.setFontSize(9);
      const detailLabelX = rightColX + 8;
      const detailValueX = rightColX + colWidth - 8;
      let detailY = yPos + 20;

      const addDetailRow = (label: string, value: string) => {
        doc.setTextColor(...grayText);
        doc.setFont("helvetica", "normal");
        doc.text(label, detailLabelX, detailY);
        doc.setTextColor(...darkText);
        doc.setFont("helvetica", "bold");
        doc.text(value, detailValueX, detailY, { align: "right" });
        detailY += 6;
      };

      addDetailRow("Invoice Date:", format(new Date(invoice.created_at), "dd MMMM yyyy"));
      addDetailRow("Billing Period:", `${format(new Date(invoice.billing_period_start), "dd MMM")} - ${format(new Date(invoice.billing_period_end), "dd MMM yyyy")}`);
      addDetailRow("Due Date:", invoice.due_date ? format(new Date(invoice.due_date), "dd MMM yyyy") : "On Receipt");

      // Payment Status Badge
      detailY += 2;
      const statusText = invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1);
      let statusBg: [number, number, number];
      let statusTextColor: [number, number, number] = [255, 255, 255];
      
      switch (invoice.payment_status) {
        case "paid":
          statusBg = [34, 139, 34]; // Forest green
          break;
        case "partial":
          statusBg = [230, 160, 40]; // Amber
          break;
        case "overdue":
          statusBg = [200, 50, 50]; // Red
          break;
        default:
          statusBg = [100, 100, 100]; // Gray
      }
      
      doc.setFillColor(...statusBg);
      const statusWidth = doc.getTextWidth(statusText) + 12;
      doc.roundedRect(detailLabelX, detailY - 4, statusWidth, 8, 1.5, 1.5, "F");
      doc.setTextColor(...statusTextColor);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(statusText, detailLabelX + statusWidth / 2, detailY + 1, { align: "center" });

      yPos += 55;

      // === ITEMS TABLE ===
      // Note: jsPDF's default fonts don't support ₹ symbol properly, using "Rs." for compatibility
      const currencySymbol = "Rs.";
      
      interface GroupedItem {
        product_name: string;
        unit: string;
        quantity: number;
        unit_price: number;
        total_amount: number;
      }

      let tableData: string[][] = [];

      if (items.length > 0) {
        // Group items by product and rate
        const groupedItems = items.reduce((acc: Record<string, GroupedItem>, item) => {
          const key = `${item.product_name}_${item.unit_price}`;
          if (!acc[key]) {
            acc[key] = {
              product_name: item.product_name,
              unit: item.unit,
              quantity: 0,
              unit_price: item.unit_price,
              total_amount: 0,
            };
          }
          acc[key].quantity += item.quantity;
          acc[key].total_amount += item.total_amount;
          return acc;
        }, {});

        tableData = Object.values(groupedItems).map((item, index) => [
          String(index + 1),
          item.product_name,
          `${item.quantity.toFixed(2)} ${item.unit}`,
          `${currencySymbol} ${item.unit_price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `${currencySymbol} ${item.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ]);
      } else if (invoice.notes) {
        // Parse from notes
        const noteLines = invoice.notes.split("; ").filter(line => line.trim());
        tableData = noteLines.map((line, index) => {
          const match = line.match(/(.+?):\s*([\d.]+)\s*(\w+)\s*@\s*₹([\d.]+)/);
          if (match) {
            const [, product, qty, unit, rate] = match;
            const amount = parseFloat(qty) * parseFloat(rate);
            return [
              String(index + 1),
              product.trim(),
              `${parseFloat(qty).toFixed(2)} ${unit}`,
              `${currencySymbol} ${parseFloat(rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              `${currencySymbol} ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            ];
          }
          return [String(index + 1), line.trim(), "-", "-", "-"];
        });
      }

      if (tableData.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [["#", "Product Description", "Quantity", "Unit Rate", "Amount"]],
          body: tableData,
          margin: { left: margin, right: margin },
          headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 10,
            cellPadding: 5,
            halign: "center",
            valign: "middle",
          },
          bodyStyles: {
            textColor: darkText,
            fontSize: 10,
            cellPadding: 5,
            valign: "middle",
          },
          alternateRowStyles: {
            fillColor: [250, 250, 250],
          },
          columnStyles: {
            0: { cellWidth: 15, halign: "center" },
            1: { cellWidth: "auto", halign: "left" },
            2: { cellWidth: 35, halign: "center" },
            3: { cellWidth: 35, halign: "right" },
            4: { cellWidth: 40, halign: "right", fontStyle: "bold" },
          },
          styles: {
            lineColor: borderColor,
            lineWidth: 0.3,
            overflow: "linebreak",
          },
          tableLineColor: borderColor,
          tableLineWidth: 0.3,
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      } else {
        // No items - show message
        doc.setTextColor(...grayText);
        doc.setFontSize(10);
        doc.text("No delivery items found for this billing period.", margin, yPos + 10);
        yPos += 25;
      }

      // === SUMMARY SECTION ===
      const summaryWidth = 95;
      const summaryX = pageWidth - margin - summaryWidth;
      const summaryHeight = Number(invoice.discount_amount) > 0 ? 65 : 58;
      
      doc.setFillColor(...lightBg);
      doc.setDrawColor(...borderColor);
      doc.roundedRect(summaryX, yPos, summaryWidth, summaryHeight, 2, 2, "FD");

      let sumY = yPos + 10;
      const sumLabelX = summaryX + 8;
      const sumValueX = summaryX + summaryWidth - 8;

      doc.setFontSize(9);

      // Format currency with Indian locale (reusing currencySymbol from table section)
      const formatCurrency = (amount: number) => {
        return `${currencySymbol} ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      };

      // Subtotal
      doc.setTextColor(...grayText);
      doc.setFont("helvetica", "normal");
      doc.text("Subtotal:", sumLabelX, sumY);
      doc.setTextColor(...darkText);
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(Number(invoice.total_amount)), sumValueX, sumY, { align: "right" });

      // Tax
      sumY += 8;
      doc.setTextColor(...grayText);
      doc.setFont("helvetica", "normal");
      doc.text("Tax:", sumLabelX, sumY);
      doc.setTextColor(...darkText);
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(Number(invoice.tax_amount || 0)), sumValueX, sumY, { align: "right" });

      // Discount (if any)
      if (Number(invoice.discount_amount) > 0) {
        sumY += 8;
        doc.setTextColor(34, 139, 34);
        doc.setFont("helvetica", "normal");
        doc.text("Discount:", sumLabelX, sumY);
        doc.setFont("helvetica", "bold");
        doc.text(`- ${formatCurrency(Number(invoice.discount_amount))}`, sumValueX, sumY, { align: "right" });
      }

      // Divider
      sumY += 8;
      doc.setDrawColor(...goldColor);
      doc.setLineWidth(1);
      doc.line(sumLabelX, sumY, sumValueX, sumY);

      // Grand Total Box - Centered
      sumY += 10;
      const grandTotalBoxWidth = summaryWidth - 8;
      const grandTotalBoxX = sumLabelX - 4;
      
      doc.setFillColor(...primaryColor);
      doc.roundedRect(grandTotalBoxX, sumY - 6, grandTotalBoxWidth, 18, 3, 3, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      
      const grandTotalLabel = "GRAND TOTAL";
      const grandTotalValue = formatCurrency(Number(invoice.final_amount));
      const boxCenterX = grandTotalBoxX + grandTotalBoxWidth / 2;
      
      // Center the grand total label and value
      doc.text(grandTotalLabel, boxCenterX, sumY + 1, { align: "center" });
      doc.setFontSize(13);
      doc.text(grandTotalValue, boxCenterX, sumY + 9, { align: "center" });

      // Amount in words - Full width, centered below summary
      const wordsY = yPos + summaryHeight + 18;
      
      // Words box spanning full width
      const amountWords = numberToIndianWords(Number(invoice.final_amount));
      
      doc.setFillColor(252, 252, 245);
      doc.setDrawColor(...goldColor);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, wordsY - 6, pageWidth - margin * 2, 22, 2, 2, "FD");
      
      doc.setTextColor(...accentColor);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Amount in Words:", margin + 8, wordsY + 2);
      
      doc.setTextColor(...darkText);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bolditalic");
      const wordsLines = doc.splitTextToSize(amountWords, pageWidth - margin * 2 - 16);
      doc.text(wordsLines, margin + 8, wordsY + 10);

      yPos = wordsY + 22 + 8;

      // === PAYMENT RECEIVED SECTION (if applicable) ===
      if (Number(invoice.paid_amount) > 0) {
        const balance = Number(invoice.final_amount) - Number(invoice.paid_amount);
        
        doc.setFillColor(230, 245, 230);
        doc.setDrawColor(34, 139, 34);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, yPos, pageWidth - margin * 2, 20, 3, 3, "FD");
        
        const paymentBoxCenter = pageWidth / 2;
        
        doc.setTextColor(34, 139, 34);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        
        const paidText = `Payment Received: ${formatCurrency(Number(invoice.paid_amount))}`;
        doc.text(paidText, margin + 12, yPos + 12);
        
        if (balance > 0) {
          doc.setTextColor(200, 50, 50);
          const balanceText = `Balance Due: ${formatCurrency(balance)}`;
          doc.text(balanceText, pageWidth - margin - 12, yPos + 12, { align: "right" });
        } else {
          doc.setTextColor(34, 139, 34);
          doc.text("FULLY PAID", pageWidth - margin - 12, yPos + 12, { align: "right" });
        }
        
        yPos += 28;
      }

      // === TERMS AND BANK DETAILS ===
      if (yPos < pageHeight - 65) {
        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        
        yPos += 8;
        
        doc.setTextColor(...accentColor);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("TERMS & CONDITIONS", margin, yPos);
        
        doc.setTextColor(...grayText);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        yPos += 5;
        doc.text("• Payment is due within 15 days from the invoice date.", margin, yPos);
        yPos += 4;
        doc.text("• Please quote invoice number for all payments.", margin, yPos);
        yPos += 4;
        doc.text("• Subject to Lucknow jurisdiction.", margin, yPos);
      }

      // === FOOTER ===
      const footerY = pageHeight - 25;
      
      // Decorative footer
      doc.setFillColor(...accentColor);
      doc.rect(0, footerY - 5, pageWidth, 2, "F");

      // Thank you message
      doc.setTextColor(...primaryColor);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Thank You for Your Business!", pageWidth / 2, footerY + 5, { align: "center" });

      // Contact and website
      doc.setTextColor(...grayText);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        "www.awadhdairy.com | contact@awadhdairy.com | +91 78977 16792",
        pageWidth / 2,
        footerY + 12,
        { align: "center" }
      );

      // Generated timestamp
      doc.setFontSize(7);
      doc.setTextColor(180, 180, 180);
      doc.text(
        `This is a computer generated invoice | Generated on ${format(new Date(), "dd MMM yyyy 'at' HH:mm")}`,
        pageWidth / 2,
        footerY + 18,
        { align: "center" }
      );

      // Bottom border
      doc.setFillColor(...primaryColor);
      doc.rect(0, pageHeight - 4, pageWidth, 4, "F");

      // Output
      if (action === "download") {
        doc.save(`Invoice_${invoice.invoice_number}_${customer.name.replace(/\s+/g, "_")}.pdf`);
        onGenerated?.();
      } else {
        const dataUrl = doc.output("datauristring");
        setPdfDataUrl(dataUrl);
        setPreviewOpen(true);
      }
    } catch (error) {
      logger.error("InvoicePDF", "Error generating PDF", error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => generatePDF("preview")}
          disabled={generating}
        >
          <Eye className="h-3 w-3" />
        </Button>
        <Button
          variant="default"
          size="sm"
          className="gap-1"
          onClick={() => generatePDF("download")}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          PDF
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>Invoice Preview - {invoice.invoice_number}</DialogTitle>
          </DialogHeader>
          {pdfDataUrl && (
            <iframe
              src={pdfDataUrl}
              className="w-full h-full rounded-lg border"
              title="Invoice Preview"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
