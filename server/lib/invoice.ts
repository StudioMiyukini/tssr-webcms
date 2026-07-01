import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { formatPriceEUR, generateInvoiceNumber } from './utils';
import { readThemeSettings } from '../routes/settings';

interface OrderForInvoice {
  order_number: string;
  invoice_number?: string | null;
  customer_name: string;
  customer_email: string;
  created_at?: string | null;
  subtotal_cents: number;
  discount_cents?: number;
  shipping_price_cents?: number;
  tax_cents?: number;
  total_cents: number;
}

interface ItemForInvoice {
  product_name: string;
  variant_label?: string;
  quantity: number;
  line_total_cents: number;
}

export function streamInvoicePdf(res: Response, order: OrderForInvoice, items: ItemForInvoice[]): void {
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="invoice-${order.invoice_number || order.order_number}.pdf"`);
  doc.pipe(res);
  doc.fontSize(20).text(`Facture — ${readThemeSettings().brandName || 'Mon Site'}`);
  doc.moveDown();
  doc.fontSize(11).text(`Facture : ${order.invoice_number || generateInvoiceNumber(order.order_number)}`);
  doc.text(`Commande : ${order.order_number}`);
  doc.text(`Client : ${order.customer_name}`);
  doc.text(`Email : ${order.customer_email}`);
  doc.text(`Date : ${order.created_at || ''}`);
  doc.moveDown();
  items.forEach((item) => {
    doc.text(`${item.product_name}${item.variant_label ? ` — ${item.variant_label}` : ''} x ${item.quantity} · ${formatPriceEUR(item.line_total_cents)}`);
  });
  doc.moveDown();
  doc.text(`Sous-total : ${formatPriceEUR(order.subtotal_cents)}`);
  doc.text(`Remise : -${formatPriceEUR(order.discount_cents || 0)}`);
  doc.text(`Livraison : ${formatPriceEUR(order.shipping_price_cents || 0)}`);
  doc.text(`TVA : ${formatPriceEUR(order.tax_cents || 0)}`);
  doc.fontSize(14).text(`Total : ${formatPriceEUR(order.total_cents)}`);
  doc.end();
}
