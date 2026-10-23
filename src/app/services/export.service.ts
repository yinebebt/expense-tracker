import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { toCsv } from '../summary/export';
import { SmsInbox } from './sms-reader.service';
import { TransactionService } from './transaction.service';

/** Where the export went, for telling the user. */
export type ExportResult = { savedAs: string } | { shared: true };

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly txService = inject(TransactionService);

  /** All stored transactions as CSV: into Downloads on Android, a file download in the browser. */
  async exportCsv(): Promise<ExportResult> {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const name = `expense-tracker-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`;
    const text = toCsv(this.txService.transactions());

    if (Capacitor.getPlatform() === 'android') {
      const res = await SmsInbox.saveFile({ name, mimeType: 'text/csv', text });
      return res.savedAs ? { savedAs: res.savedAs } : { shared: true };
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
    return { savedAs: name };
  }
}
