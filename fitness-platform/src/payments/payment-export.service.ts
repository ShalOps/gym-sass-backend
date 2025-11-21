import { Injectable, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { PaymentService } from './payments.service';
import { DatabaseService } from '../database/database.service';
import { Transform } from 'json2csv';
import { Readable } from 'stream';
import PDFDocument from 'pdfkit';
import { PaymentStatus } from '@prisma/client';

type Transaction = {
  createdAt: Date;
  txRef: string;
  amount: number;
  status: string;
  type: string;
  customerEmail?: string;
  user?: { email?: string; firstName?: string; lastName?: string };
  chapaReference?: string;
};

@Injectable()
export class PaymentExportService {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly databaseService: DatabaseService,
  ) {}

  async exportHistory(
    user: { userId: number; role: string; email: string },
    format: 'csv' | 'pdf',
    filters: { status?: PaymentStatus; fromDate?: string; toDate?: string },
    res: Response,
  ) {
    // 1. Build Filter (Reusing logic from PaymentService)
    const where = this.paymentService.buildTransactionFilter(user, filters);

    // 2. Fetch Data (With Safety Limit)
    // We limit to 5000 records to prevent memory exhaustion.
    // For larger exports, we would need a background job + email delivery system.
    const limit = 5000;
    const transactions = await this.databaseService.payment.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });

    if (transactions.length === 0) {
      throw new BadRequestException('No transactions found to export');
    }

    // 3. Generate Output
    const mappedTransactions: Transaction[] = transactions.map((t) => ({
      createdAt: t.createdAt,
      txRef: t.txRef,
      amount:
        typeof t.amount === 'object' && 'toNumber' in t.amount
          ? t.amount.toNumber()
          : Number(t.amount),
      status: t.status,
      type: t.type,
      customerEmail: t.customerEmail ?? undefined,
      user: t.user
        ? {
            email: t.user.email ?? undefined,
            firstName: t.user.firstName ?? undefined,
            lastName: t.user.lastName ?? undefined,
          }
        : undefined,
      chapaReference: t.chapaReference ?? undefined,
    }));

    if (format === 'csv') {
      return this.generateCsv(mappedTransactions, res);
    } else {
      return this.generatePdf(mappedTransactions, user, res);
    }
  }

  private generateCsv(transactions: Transaction[], res: Response) {
    const fields = [
      {
        label: 'Date',
        value: (row: Transaction) => row.createdAt.toISOString(),
      },
      { label: 'Transaction Ref', value: 'txRef' },
      { label: 'Amount (ETB)', value: 'amount' },
      { label: 'Status', value: 'status' },
      { label: 'Type', value: 'type' },
      {
        label: 'Customer',
        value: (row: Transaction) =>
          row.customerEmail || row.user?.email || 'N/A',
      },
      { label: 'Chapa Ref', value: 'chapaReference' },
    ];

    const json2csv = new Transform({ fields }, { objectMode: true });

    res.header('Content-Type', 'text/csv');
    res.header(
      'Content-Disposition',
      `attachment; filename=transactions_${Date.now()}.csv`,
    );

    const input = new Readable({ objectMode: true });
    input._read = () => {}; // No-op

    input.pipe(json2csv).pipe(res);

    transactions.forEach((t) => input.push(t));
    input.push(null); // End of stream
  }

  private generatePdf(
    transactions: Transaction[],
    user: { userId: number; role: string; email: string },
    res: Response,
  ) {
    const doc = new PDFDocument({ margin: 50 });

    res.header('Content-Type', 'application/pdf');
    res.header(
      'Content-Disposition',
      `attachment; filename=transactions_${Date.now()}.pdf`,
    );

    doc.pipe(res);

    // Header
    doc.fontSize(20).text('Transaction History', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated for: ${user.email}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Table Header
    const tableTop = 150;
    let y = tableTop;

    this.drawTableRow(doc, y, 'Date', 'Tx Ref', 'Amount', 'Status');
    this.generateHr(doc, y + 20);
    y += 30;

    // Table Rows
    transactions.forEach((t) => {
      // Check for page break
      if (y > 700) {
        doc.addPage();
        y = 50;
        this.drawTableRow(doc, y, 'Date', 'Tx Ref', 'Amount', 'Status');
        this.generateHr(doc, y + 20);
        y += 30;
      }

      const date = new Date(t.createdAt).toLocaleDateString();
      const amount = `${t.amount} ETB`;

      this.drawTableRow(doc, y, date, t.txRef, amount, t.status);
      y += 20;
    });

    // Footer
    const totalAmount = transactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0,
    );
    doc.moveDown();
    this.generateHr(doc, y);
    doc.fontSize(14).text(`Total: ${totalAmount.toFixed(2)} ETB`, 350, y + 10, {
      align: 'right',
    });

    doc.end();
  }

  private drawTableRow(
    doc: PDFKit.PDFDocument,
    y: number,
    date: string,
    ref: string,
    amount: string,
    status: string,
  ) {
    doc
      .fontSize(10)
      .text(date, 50, y)
      .text(ref, 150, y)
      .text(amount, 350, y, { width: 90, align: 'right' })
      .text(status, 450, y, { align: 'right' });
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
