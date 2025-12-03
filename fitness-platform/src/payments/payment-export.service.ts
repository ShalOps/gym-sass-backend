import { Injectable, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { PaymentHistoryService } from './payment-history.service';
import { DatabaseService } from '../database/database.service';
import { Transform } from 'json2csv';
import { Readable } from 'stream';
import PDFDocument from 'pdfkit';
import { PaymentStatus } from '@prisma/client';

type Transaction = {
  createdAt: Date;
  txRef: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  method: string;
  description: string;
  customerName: string;
  customerEmail: string;
  chapaReference?: string;
  refundedAmount: number;
};

const EXPORT_FILENAME_CONFIG = {
  getAdminFilename: (dateStr: string) => `Total_Transaction_Report_${dateStr}`,
  getCustomerFilename: (firstName: string, lastName: string, dateStr: string) =>
    `${firstName}_${lastName}_Transaction_Report_${dateStr}`,
  formatDate: (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;

    return `${yyyy}_${mm}_${dd}_T${hours}-${minutes}_${ampm}`;
  },
};

const PDF_HEADER_CONFIG = {
  companyName: 'Fitness Platform',
  companyAddress: '123 Fitness Blvd, Addis Ababa',
};

@Injectable()
export class PaymentExportService {
  constructor(
    private readonly paymentHistoryService: PaymentHistoryService,
    private readonly databaseService: DatabaseService,
  ) {}

  async exportHistory(
    user: { userId: number; role: string; email: string },
    format: 'csv' | 'pdf',
    filters: { status?: PaymentStatus; fromDate?: string; toDate?: string },
    res: Response,
  ) {
    // 0. Ensure User Email (JWT payload might lack it)
    let userEmail = user.email;
    let userFirstName = '';
    let userLastName = '';

    if (!userEmail) {
      const dbUser = await this.databaseService.user.findUnique({
        where: { userId: user.userId },
        select: { email: true, firstName: true, lastName: true },
      });
      userEmail = dbUser?.email || 'Unknown';
      userFirstName = dbUser?.firstName || '';
      userLastName = dbUser?.lastName || '';
    }
    const exportUser = {
      ...user,
      email: userEmail,
      firstName: userFirstName,
      lastName: userLastName,
    };

    // 1. Build Filter (Reusing logic from PaymentHistoryService)
    const where = this.paymentHistoryService.buildTransactionFilter(
      exportUser,
      filters,
    );

    // 2. Fetch Data (With Safety Limit)
    const limit = 5000;
    const transactions = await this.databaseService.payment.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
        classBooking: {
          include: { class: true },
        },
        serviceBooking: {
          include: { service: true },
        },
      },
    });

    if (transactions.length === 0) {
      throw new BadRequestException('No transactions found to export');
    }

    // 3. Generate Output
    const mappedTransactions: Transaction[] = transactions.map((t) => {
      // Derive Description
      let description = t.type.toString();
      if (t.classBooking?.class?.className) {
        description = `Class: ${t.classBooking.class.className}`;
      } else if (t.serviceBooking?.service?.name) {
        description = `Service: ${t.serviceBooking.service.name}`;
      }

      // Derive Customer Name
      const customerName = t.user
        ? `${t.user.firstName} ${t.user.lastName}`
        : t.customerFirstName
          ? `${t.customerFirstName} ${t.customerLastName}`
          : 'Guest';

      return {
        createdAt: t.createdAt,
        txRef: t.txRef,
        amount:
          typeof t.amount === 'object' && 'toNumber' in t.amount
            ? t.amount.toNumber()
            : Number(t.amount),
        currency: t.currency,
        status: t.status,
        type: t.type,
        method: t.method || 'N/A',
        description,
        customerName,
        customerEmail: t.user?.email || t.customerEmail || 'N/A',
        chapaReference: t.chapaReference || undefined,
        refundedAmount:
          t.refundedAmount &&
          typeof t.refundedAmount === 'object' &&
          'toNumber' in t.refundedAmount
            ? t.refundedAmount.toNumber()
            : Number(t.refundedAmount || 0),
      };
    });

    if (format === 'csv') {
      return this.generateCsv(mappedTransactions, exportUser, res);
    } else {
      return this.generatePdf(mappedTransactions, exportUser, res);
    }
  }

  private getFilename(
    user: { role: string; firstName?: string; lastName?: string },
    extension: string,
  ): string {
    const dateStr = EXPORT_FILENAME_CONFIG.formatDate(new Date());
    const isAdminOrOwner = user.role === 'ADMIN' || user.role === 'GYMOWNER';

    let filename = '';
    if (isAdminOrOwner) {
      filename = EXPORT_FILENAME_CONFIG.getAdminFilename(dateStr);
    } else {
      const first = user.firstName || 'Customer';
      const last = user.lastName || '';
      filename = EXPORT_FILENAME_CONFIG.getCustomerFilename(
        first,
        last,
        dateStr,
      );
    }

    // Sanitize spaces to underscores if any
    filename = filename.replace(/\s+/g, '_');
    return `${filename}.${extension}`;
  }

  private generateCsv(
    transactions: Transaction[],
    user: {
      userId: number;
      role: string;
      email: string;
      firstName?: string;
      lastName?: string;
    },
    res: Response,
  ) {
    const isAdminOrOwner = user.role === 'ADMIN' || user.role === 'GYMOWNER';

    const fields = [
      {
        label: 'Date',
        value: (row: Transaction) => row.createdAt.toISOString(),
      },
      { label: 'Description', value: 'description' },
      { label: 'Method', value: 'method' },
      { label: 'Transaction Ref', value: 'txRef' },
      { label: 'Chapa Ref', value: 'chapaReference' },
      { label: 'Status', value: 'status' },
      { label: 'Currency', value: 'currency' },
      { label: 'Amount', value: 'amount' },
    ];

    if (isAdminOrOwner) {
      fields.push(
        { label: 'Customer Name', value: 'customerName' },
        { label: 'Customer Email', value: 'customerEmail' },
      );
    }

    // Calculate Net Revenue
    const netRevenue = transactions.reduce((sum, t) => {
      if (['PROCESSED', 'PAID_MANUAL'].includes(t.status)) {
        return sum + t.amount;
      }
      if (t.status === 'PARTIALLY_REFUNDED') {
        return sum + (t.amount - t.refundedAmount);
      }
      return sum;
    }, 0);

    const totalCount = transactions.length;

    const json2csv = new Transform({ fields }, { objectMode: true });

    res.header('Content-Type', 'text/csv');
    res.header(
      'Content-Disposition',
      `attachment; filename=${this.getFilename(user, 'csv')}`,
    );

    res.write(`Generated for: ${user.email}\n`);
    res.write(`Date: ${new Date().toLocaleDateString()}\n`);
    res.write(`Total Transactions: ${totalCount}\n`);
    res.write(
      `${isAdminOrOwner ? 'Net Revenue' : 'Total Amount'}: ${netRevenue.toFixed(2)} ETB\n\n`,
    );

    const input = new Readable({ objectMode: true });
    input._read = () => {}; // No-op

    input.pipe(json2csv).pipe(res);

    transactions.forEach((t) => input.push(t));
    input.push(null); // End of stream
  }

  private generatePdf(
    transactions: Transaction[],
    user: {
      userId: number;
      role: string;
      email: string;
      firstName?: string;
      lastName?: string;
    },
    res: Response,
  ) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.header('Content-Type', 'application/pdf');
    res.header(
      'Content-Disposition',
      `attachment; filename=${this.getFilename(user, 'pdf')}`,
    );

    doc.pipe(res);

    // --- Header Section ---
    doc
      .fontSize(20)
      .text(PDF_HEADER_CONFIG.companyName, 50, 50, { align: 'left' })
      .fontSize(10)
      .text(PDF_HEADER_CONFIG.companyAddress, 50, 75, { align: 'left' });

    doc.fontSize(16).text('Transaction History', 50, 50, { align: 'right' });

    this.generateHr(doc, 100);

    // --- Customer Info & Summary ---
    const customerY = 120;
    const isAdminOrOwner = user.role === 'ADMIN' || user.role === 'GYMOWNER';

    if (isAdminOrOwner) {
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Report Generated By:', 50, customerY);
      doc
        .font('Helvetica')
        .text(
          `${user.firstName || ''} ${user.lastName || ''} (${user.role})`.trim(),
          50,
          customerY + 15,
        )
        .text(user.email, 50, customerY + 30);
    } else {
      doc.fontSize(10).font('Helvetica-Bold').text('Bill To:', 50, customerY);
      doc
        .font('Helvetica')
        .text(
          `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer',
          50,
          customerY + 15,
        )
        .text(user.email, 50, customerY + 30);
    }

    const summaryY = 120;
    // Calculate Net Revenue
    // Revenue = (PROCESSED + PAID_MANUAL) + (PARTIALLY_REFUNDED - refundedAmount)
    // Excludes: FAILED, PENDING, DUPLICATE, REFUNDED (assuming full refund)
    const netRevenue = transactions.reduce((sum, t) => {
      if (['PROCESSED', 'PAID_MANUAL'].includes(t.status)) {
        return sum + t.amount;
      }
      if (t.status === 'PARTIALLY_REFUNDED') {
        return sum + (t.amount - t.refundedAmount);
      }
      return sum;
    }, 0);

    const totalCount = transactions.length;

    doc.font('Helvetica-Bold').text('Summary:', 350, summaryY);
    doc
      .font('Helvetica')
      .text(`Total Transactions: ${totalCount}`, 350, summaryY + 15)
      .text(
        `${isAdminOrOwner ? 'Net Revenue' : 'Total Amount'}: ${netRevenue.toFixed(2)} ETB`,
        350,
        summaryY + 30,
      );

    doc.moveDown(4);

    // --- Table Header ---
    const tableTop = 200;
    let y = tableTop;

    this.drawTableHeader(doc, y, isAdminOrOwner);
    this.generateHr(doc, y + 20);
    y += 30;

    // --- Table Rows ---
    doc.font('Helvetica');
    transactions.forEach((t) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
        this.drawTableHeader(doc, y, isAdminOrOwner);
        this.generateHr(doc, y + 20);
        y += 30;
      }

      const date = new Date(t.createdAt).toLocaleDateString();
      const amount = `${t.amount.toFixed(2)}`;

      this.drawTableRow(
        doc,
        y,
        date,
        t.description,
        t.method,
        t.txRef,
        t.status,
        amount,
        isAdminOrOwner,
        t.customerName,
      );
      y += 20;
    });

    // --- Footer ---
    this.generateHr(doc, y);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc
      .fontSize(10)
      .fillColor('grey')
      .text(
        `Generated on ${new Date().toLocaleString()}`,
        50,
        doc.page.height - 50,
        {
          align: 'center',
        },
      );

    doc.page.margins.bottom = bottomMargin;

    doc.end();
  }

  private drawTableHeader(
    doc: PDFKit.PDFDocument,
    y: number,
    isAdminOrOwner: boolean,
  ) {
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Date', 40, y);

    if (isAdminOrOwner) {
      doc.text('Customer', 90, y);
      doc.text('Description', 170, y);
      doc.text('Method', 260, y);
      doc.text('Ref', 330, y);
      doc.text('Status', 400, y);
      doc.text('Amount (ETB)', 480, y, { align: 'right', width: 70 });
    } else {
      doc.text('Description', 110, y);
      doc.text('Method', 220, y);
      doc.text('Ref', 290, y);
      doc.text('Status', 380, y);
      doc.text('Amount (ETB)', 460, y, { align: 'right', width: 90 });
    }
  }

  private drawTableRow(
    doc: PDFKit.PDFDocument,
    y: number,
    date: string,
    desc: string,
    method: string,
    ref: string,
    status: string,
    amount: string,
    isAdminOrOwner: boolean,
    customerName?: string,
  ) {
    doc.fontSize(8).font('Helvetica');
    doc.text(date, 40, y);

    if (isAdminOrOwner) {
      doc.text((customerName || 'Guest').substring(0, 15), 90, y);
      doc.text(desc.substring(0, 15), 170, y);
      doc.text(method.substring(0, 12), 260, y);
      doc.text(ref.substring(0, 10) + '...', 330, y);
      doc.text(status, 400, y);
      doc.text(amount, 480, y, { align: 'right', width: 70 });
    } else {
      doc.text(desc.substring(0, 20), 110, y);
      doc.text(method.substring(0, 15), 220, y);
      doc.text(ref.substring(0, 15) + '...', 290, y);
      doc.text(status, 380, y);
      doc.text(amount, 460, y, { align: 'right', width: 90 });
    }
  }

  private generateHr(doc: PDFKit.PDFDocument, y: number) {
    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, y)
      .lineTo(550, y)
      .stroke();
  }
}
