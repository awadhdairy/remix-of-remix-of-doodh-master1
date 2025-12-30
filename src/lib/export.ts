import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface ExportColumn {
  key: string;
  header: string;
  width?: number;
}

// Export to Excel
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string,
  sheetName: string = 'Sheet1'
) {
  const wsData = [
    columns.map(col => col.header),
    ...data.map(row => columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return value;
    }))
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }));
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

// Export to PDF
export function exportToPDF<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string,
  title: string,
  options?: {
    orientation?: 'portrait' | 'landscape';
    subtitle?: string;
  }
) {
  const doc = new jsPDF({
    orientation: options?.orientation || 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Add title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 22);

  // Add subtitle/date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(options?.subtitle || `Generated on ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 30);

  // Add table
  autoTable(doc, {
    head: [columns.map(col => col.header)],
    body: data.map(row => columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    })),
    startY: 38,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [34, 139, 34], // Green color to match theme
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

// Export to CSV
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
) {
  const csvContent = [
    columns.map(col => `"${col.header}"`).join(','),
    ...data.map(row => 
      columns.map(col => {
        const value = row[col.key];
        if (value === null || value === undefined) return '""';
        if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
        return `"${value}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// Common export columns for different data types
export const exportColumns = {
  customers: [
    { key: 'name', header: 'Customer Name', width: 20 },
    { key: 'phone', header: 'Phone', width: 15 },
    { key: 'email', header: 'Email', width: 25 },
    { key: 'address', header: 'Address', width: 30 },
    { key: 'area', header: 'Area', width: 15 },
    { key: 'subscription_type', header: 'Subscription', width: 12 },
    { key: 'credit_balance', header: 'Balance', width: 12 },
    { key: 'is_active', header: 'Active', width: 8 },
  ],
  cattle: [
    { key: 'tag_number', header: 'Tag Number', width: 12 },
    { key: 'name', header: 'Name', width: 15 },
    { key: 'breed', header: 'Breed', width: 15 },
    { key: 'cattle_type', header: 'Type', width: 10 },
    { key: 'status', header: 'Status', width: 10 },
    { key: 'lactation_status', header: 'Lactation', width: 12 },
    { key: 'date_of_birth', header: 'DOB', width: 12 },
    { key: 'weight', header: 'Weight (kg)', width: 12 },
  ],
  production: [
    { key: 'production_date', header: 'Date', width: 12 },
    { key: 'cattle_tag', header: 'Cattle', width: 12 },
    { key: 'session', header: 'Session', width: 10 },
    { key: 'quantity_liters', header: 'Quantity (L)', width: 12 },
    { key: 'fat_percentage', header: 'Fat %', width: 10 },
    { key: 'snf_percentage', header: 'SNF %', width: 10 },
  ],
  invoices: [
    { key: 'invoice_number', header: 'Invoice #', width: 15 },
    { key: 'customer_name', header: 'Customer', width: 20 },
    { key: 'billing_period_start', header: 'Period Start', width: 12 },
    { key: 'billing_period_end', header: 'Period End', width: 12 },
    { key: 'total_amount', header: 'Total', width: 12 },
    { key: 'paid_amount', header: 'Paid', width: 12 },
    { key: 'payment_status', header: 'Status', width: 10 },
    { key: 'due_date', header: 'Due Date', width: 12 },
  ],
  expenses: [
    { key: 'expense_date', header: 'Date', width: 12 },
    { key: 'title', header: 'Title', width: 25 },
    { key: 'category', header: 'Category', width: 15 },
    { key: 'amount', header: 'Amount', width: 12 },
    { key: 'notes', header: 'Notes', width: 30 },
  ],
  deliveries: [
    { key: 'delivery_date', header: 'Date', width: 12 },
    { key: 'customer_name', header: 'Customer', width: 20 },
    { key: 'status', header: 'Status', width: 12 },
    { key: 'delivery_time', header: 'Time', width: 10 },
    { key: 'notes', header: 'Notes', width: 25 },
  ],
  employees: [
    { key: 'name', header: 'Name', width: 20 },
    { key: 'phone', header: 'Phone', width: 15 },
    { key: 'role', header: 'Role', width: 15 },
    { key: 'salary', header: 'Salary', width: 12 },
    { key: 'joining_date', header: 'Joining Date', width: 12 },
    { key: 'is_active', header: 'Active', width: 8 },
  ],
  payroll: [
    { key: 'employee_name', header: 'Employee', width: 20 },
    { key: 'pay_period_start', header: 'Period Start', width: 12 },
    { key: 'pay_period_end', header: 'Period End', width: 12 },
    { key: 'base_salary', header: 'Base Salary', width: 12 },
    { key: 'bonus', header: 'Bonus', width: 10 },
    { key: 'deductions', header: 'Deductions', width: 10 },
    { key: 'net_salary', header: 'Net Salary', width: 12 },
    { key: 'payment_status', header: 'Status', width: 10 },
  ],
};
