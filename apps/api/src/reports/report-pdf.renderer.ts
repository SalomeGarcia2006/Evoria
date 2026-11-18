import { BadRequestException } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface PdfMetric {
  label: string;
  value: string;
  note?: string;
}
export interface PdfCell {
  text: string;
  tone?: 'muted' | 'teal' | 'warning';
}
export interface PdfColumn {
  label: string;
  weight: number;
  align?: 'left' | 'right';
}
export type PdfSection =
  | {
      kind: 'fields';
      title: string;
      items: Array<{ label: string; value: string }>;
    }
  | { kind: 'text'; title: string; body: string }
  | { kind: 'notice'; title: string; body: string }
  | {
      kind: 'table';
      title: string;
      columns: PdfColumn[];
      rows: PdfCell[][];
      note?: string;
      intro?: string;
    }
  | {
      kind: 'budget';
      title: string;
      allocated: number;
      spent: number;
      remaining: number;
    };
export interface ReportPdfDocument {
  title: string;
  subtitle: string;
  company: string;
  nit?: string;
  reference: string;
  generatedAt: Date;
  generatedBy: string;
  filters: string[];
  metrics: PdfMetric[];
  sections: PdfSection[];
  sampleNotice?: string;
}

const C = {
  navy: '#152941',
  teal: '#008D85',
  ink: '#23394F',
  muted: '#61758A',
  light: '#F1F5F9',
  line: '#DCE5EE',
  white: '#FFFFFF',
  amber: '#9A5700',
};
const M = 44;
const regular =
  require.resolve('@fontsource/lato/files/lato-latin-400-normal.woff');
const bold =
  require.resolve('@fontsource/lato/files/lato-latin-700-normal.woff');
export const pdfMoney = (value: number) =>
  `$ ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value)}`;
export const pdfDate = (value: Date | string) =>
  new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(value));

/** Vector layout with embedded fonts. No browser, remote assets or runtime
 * Python dependency. All text is measured before it is placed on the page. */
class CorporateReportPdf {
  private readonly doc: PDFKit.PDFDocument;
  private y = 0;
  private pages = 0;
  private section = 0;
  private width = 0;
  private bottom = 0;
  constructor(private readonly input: ReportPdfDocument) {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: M,
      autoFirstPage: false,
      bufferPages: true,
      compress: true,
      info: {
        Title: `${input.title} | ${input.company}`,
        Author: input.generatedBy,
        Creator: 'EVORIA',
        Subject: 'Reporte operativo de la empresa activa',
        CreationDate: input.generatedAt,
      },
    });
    this.doc.registerFont('Body', regular).registerFont('Bold', bold);
  }
  private clean(value: string): string {
    if (value.length > 20000)
      throw new BadRequestException(
        'Un campo del reporte es demasiado extenso.',
      );
    return value
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ')
      .replace(/[\u2010-\u2015]/g, '-')
      .replace(/[\u00A0\u202F]/g, ' ');
  }
  private font(size: number, heavy = false) {
    this.doc.font(heavy ? 'Bold' : 'Body').fontSize(size);
  }
  private lines(
    value: string,
    width: number,
    size = 9,
    heavy = false,
  ): string[] {
    this.font(size, heavy);
    const result: string[] = [];
    for (const paragraph of this.clean(value).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (this.doc.widthOfString(word) > width) {
          if (line) {
            result.push(line);
            line = '';
          }
          let part = '';
          for (const character of word) {
            if (part && this.doc.widthOfString(part + character) > width) {
              result.push(part);
              part = '';
            }
            part += character;
          }
          line = part;
        } else if (line && this.doc.widthOfString(`${line} ${word}`) > width) {
          result.push(line);
          line = word;
        } else line = line ? `${line} ${word}` : word;
      }
      result.push(line);
    }
    return result;
  }
  private oneLine(value: string, width: number, size: number, heavy = false) {
    this.font(size, heavy);
    let text = this.clean(value).replace(/\s+/g, ' ');
    if (this.doc.widthOfString(text) <= width) return text;
    while (text && this.doc.widthOfString(`${text}...`) > width)
      text = text.slice(0, -1);
    return `${text}...`;
  }
  private text(
    value: string,
    x: number,
    y: number,
    width: number,
    size = 9,
    color = C.ink,
    heavy = false,
    align: 'left' | 'right' = 'left',
  ) {
    this.font(size, heavy);
    this.doc.fillColor(color).text(this.clean(value), x, y, {
      width,
      lineBreak: false,
      align,
      height: size + 5,
    });
  }
  private blockLines(
    lines: string[],
    x: number,
    y: number,
    width: number,
    size: number,
    color = C.ink,
    heavy = false,
    lineHeight = size + 4,
    align: 'left' | 'right' = 'left',
  ) {
    lines.forEach((line, i) =>
      this.text(line, x, y + i * lineHeight, width, size, color, heavy, align),
    );
  }
  private fill(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    radius = 0,
  ) {
    this.doc.save();
    if (radius) this.doc.roundedRect(x, y, width, height, radius).fill(color);
    else this.doc.rect(x, y, width, height).fill(color);
    this.doc.restore();
  }
  private rule(y: number, color = C.line) {
    this.doc
      .save()
      .moveTo(M, y)
      .lineTo(M + this.width, y)
      .lineWidth(0.6)
      .strokeColor(color)
      .stroke()
      .restore();
  }
  private page() {
    if (++this.pages > 100)
      throw new BadRequestException(
        'El PDF supera 100 páginas; reduce los filtros.',
      );
    this.doc.addPage();
    this.width = this.doc.page.width - M * 2;
    this.bottom = this.doc.page.height - 66;
    this.fill(0, 0, this.doc.page.width, 4, C.teal);
    this.text('EVORIA', M, 29, 112, 21, C.navy, true);
    this.doc
      .save()
      .circle(M + 83, 49, 1.7)
      .fill(C.teal)
      .restore();
    this.text('GESTIÓN QUE CONECTA', M, 56, 170, 7.2, C.muted, true);
    this.text(
      'INFORMACIÓN EMPRESARIAL',
      M + this.width - 210,
      34,
      210,
      8,
      C.muted,
      true,
      'right',
    );
    this.text(
      this.oneLine(this.input.company, 235, 8.5),
      M + this.width - 235,
      51,
      235,
      8.5,
      C.ink,
      false,
      'right',
    );
    this.rule(75);
    this.y = 96;
    if (this.pages > 1) {
      this.text(
        this.oneLine(this.input.title, this.width - 90, 10, true),
        M,
        this.y,
        this.width - 90,
        10,
        C.navy,
        true,
      );
      this.text(
        'CONTINUACIÓN',
        M + this.width - 90,
        this.y + 1,
        90,
        7.5,
        C.muted,
        false,
        'right',
      );
      this.y += 30;
    }
  }
  private ensure(height: number) {
    if (this.y + height > this.bottom) this.page();
  }
  private paragraph(value: string, size = 10, color = C.ink) {
    for (const line of this.lines(value, this.width, size)) {
      this.ensure(size + 5);
      this.text(line, M, this.y, this.width, size, color);
      this.y += size + 5;
    }
    this.y += 7;
  }
  private heading(title: string, continued = false) {
    this.ensure(66);
    if (!continued) this.section += 1;
    this.text(
      String(this.section).padStart(2, '0'),
      M,
      this.y + 3,
      24,
      9,
      C.teal,
      true,
    );
    this.text(
      this.oneLine(
        `${title.toLocaleUpperCase('es')}${continued ? ' / CONTINUACIÓN' : ''}`,
        this.width - 31,
        9.5,
        true,
      ),
      M + 31,
      this.y + 3,
      this.width - 31,
      9.5,
      C.navy,
      true,
    );
    this.rule(this.y + 23);
    this.y += 36;
  }
  private hero() {
    this.text('REPORTE EJECUTIVO', M, this.y, this.width, 8, C.teal, true);
    this.y += 18;
    const title = this.lines(this.input.title, this.width, 28, true);
    this.blockLines(title, M, this.y, this.width, 28, C.navy, true, 33);
    this.y += title.length * 33 + 8;
    this.paragraph(this.input.subtitle, 10.5, C.muted);
    this.paragraph(
      `${this.input.company}${this.input.nit ? `  |  NIT ${this.input.nit}` : ''}`,
      10,
      C.ink,
    );
    this.text(
      `${pdfDate(this.input.generatedAt)}  |  Bogotá (UTC-05)`,
      M,
      this.y,
      this.width,
      8,
      C.muted,
    );
    this.y += 15;
    this.paragraph(
      `Generado por ${this.input.generatedBy}  |  ${this.input.reference}`,
      8,
      C.muted,
    );
    if (this.input.sampleNotice)
      this.paragraph(this.input.sampleNotice, 8.5, C.amber);
    this.y += 7;
    for (let start = 0; start < this.input.metrics.length; start += 4) {
      this.ensure(88);
      const batch = this.input.metrics.slice(start, start + 4);
      const width = (this.width - (batch.length - 1) * 10) / batch.length;
      batch.forEach((metric, index) => {
        const x = M + index * (width + 10);
        this.fill(x, this.y, width, 79, C.light, 5);
        this.fill(x, this.y, 3, 79, C.teal, 1);
        this.blockLines(
          this.lines(
            metric.label.toLocaleUpperCase('es'),
            width - 23,
            7.1,
            true,
          ),
          x + 12,
          this.y + 11,
          width - 23,
          7.1,
          C.muted,
          true,
          9,
        );
        let size = 21;
        this.font(size, true);
        while (size > 10 && this.doc.widthOfString(metric.value) > width - 24)
          this.font(--size, true);
        this.text(
          metric.value,
          x + 12,
          this.y + 32,
          width - 24,
          size,
          C.navy,
          true,
        );
        if (metric.note)
          this.text(
            this.oneLine(metric.note, width - 24, 7.2),
            x + 12,
            this.y + 62,
            width - 24,
            7.2,
            C.muted,
          );
      });
      this.y += 94;
    }
    if (this.input.filters.length)
      this.paragraph(
        `Alcance: ${this.input.filters.join('  |  ')}`,
        8,
        C.muted,
      );
    this.y += 9;
  }
  private fields(section: Extract<PdfSection, { kind: 'fields' }>) {
    const column = (this.width - 24) / 2;
    const firstHeight =
      Math.max(
        1,
        ...section.items
          .slice(0, 2)
          .map((item) => this.lines(item.value, column, 10).length),
      ) *
        14 +
      28;
    this.ensure(36 + firstHeight);
    this.heading(section.title);
    for (let i = 0; i < section.items.length; i += 2) {
      const pair = section.items.slice(i, i + 2);
      const wrapped = pair.map((item) => this.lines(item.value, column, 10));
      const height =
        Math.max(...wrapped.map((lines) => lines.length)) * 14 + 28;
      if (height > 620)
        throw new BadRequestException(
          'Un detalle del reporte es demasiado extenso.',
        );
      this.ensure(height);
      pair.forEach((item, index) => {
        const x = M + index * (column + 24);
        this.text(
          item.label.toLocaleUpperCase('es'),
          x,
          this.y,
          column,
          7.4,
          C.muted,
          true,
        );
        this.blockLines(
          wrapped[index],
          x,
          this.y + 14,
          column,
          10,
          C.ink,
          false,
          14,
        );
      });
      this.y += height;
    }
    this.y += 3;
  }
  private table(section: Extract<PdfSection, { kind: 'table' }>) {
    if (!section.rows.length) {
      this.heading(section.title);
      this.paragraph('Sin registros para el alcance seleccionado.', 9, C.muted);
      return;
    }
    const totalWeight = section.columns.reduce(
      (sum, col) => sum + col.weight,
      0,
    );
    const widths = section.columns.map(
      (col) => (this.width * col.weight) / totalWeight,
    );
    const headerLines = section.columns.map((col, index) =>
      this.lines(col.label, widths[index] - 18, 7.5, true),
    );
    const headerHeight =
      Math.max(1, ...headerLines.map((lines) => lines.length)) * 10 + 17;
    const introHeight = section.intro
      ? this.lines(section.intro, this.width, 8.5).length * 13.5 + 7
      : 0;
    this.ensure(36 + introHeight + headerHeight + 30);
    this.heading(section.title);
    if (section.intro) this.paragraph(section.intro, 8.5, C.muted);
    const header = () => {
      this.fill(M, this.y, this.width, headerHeight, C.navy);
      let x = M;
      section.columns.forEach((col, index) => {
        this.blockLines(
          headerLines[index],
          x + 9,
          this.y + 8,
          widths[index] - 18,
          7.5,
          C.white,
          true,
          10,
          col.align,
        );
        x += widths[index];
      });
      this.y += headerHeight;
    };
    this.ensure(headerHeight + 30);
    header();
    section.rows.forEach((row, rowIndex) => {
      const pending = section.columns.map((_, i) =>
        this.lines(row[i]?.text ?? '-', widths[i] - 18, 8.6),
      );
      while (pending.some((lines) => lines.length)) {
        const desired =
          Math.max(...pending.map((lines) => lines.length)) * 12 + 14;
        if (this.y + Math.min(desired, 38) > this.bottom) {
          this.page();
          this.heading(section.title, true);
          if (section.intro) this.paragraph(section.intro, 8.5, C.muted);
          header();
        }
        const available = Math.max(
          1,
          Math.floor((this.bottom - this.y - 14) / 12),
        );
        const take = Math.min(
          available,
          Math.max(...pending.map((lines) => lines.length)),
        );
        const height = take * 12 + 14;
        this.fill(
          M,
          this.y,
          this.width,
          height,
          rowIndex % 2 ? C.light : C.white,
        );
        let x = M;
        section.columns.forEach((col, i) => {
          const tone = row[i]?.tone;
          const color =
            tone === 'warning'
              ? C.amber
              : tone === 'teal'
                ? C.teal
                : tone === 'muted'
                  ? C.muted
                  : C.ink;
          this.blockLines(
            pending[i].splice(0, take),
            x + 9,
            this.y + 6,
            widths[i] - 18,
            8.6,
            color,
            false,
            12,
            col.align,
          );
          x += widths[i];
        });
        this.y += height;
        this.rule(this.y, '#E7EDF3');
      }
    });
    this.y += 12;
    if (section.note) this.paragraph(section.note, 8, C.muted);
    this.y += 9;
  }
  private budget(section: Extract<PdfSection, { kind: 'budget' }>) {
    this.ensure(140);
    this.heading(section.title);
    this.ensure(104);
    this.fill(M, this.y, this.width, 94, C.light, 5);
    this.text(
      'GASTO REGISTRADO',
      M + 16,
      this.y + 13,
      this.width / 2,
      7.5,
      C.muted,
      true,
    );
    this.text(
      `${pdfMoney(section.spent)} COP`,
      M + 16,
      this.y + 29,
      this.width / 2,
      15,
      C.navy,
      true,
    );
    const percentage =
      section.allocated > 0
        ? `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format((section.spent / section.allocated) * 100)} % ejecutado`
        : 'Sin porcentaje calculable';
    this.text(
      percentage,
      M + this.width / 2,
      this.y + 29,
      this.width / 2 - 16,
      10,
      C.teal,
      true,
      'right',
    );
    this.fill(M + 16, this.y + 57, this.width - 32, 6, C.line, 3);
    const ratio =
      section.allocated > 0
        ? Math.max(0, Math.min(1, section.spent / section.allocated))
        : 0;
    if (ratio)
      this.fill(M + 16, this.y + 57, (this.width - 32) * ratio, 6, C.teal, 3);
    this.text(
      `Asignado: ${pdfMoney(section.allocated)} COP`,
      M + 16,
      this.y + 73,
      this.width / 2,
      8,
      C.muted,
    );
    this.text(
      `Disponible: ${pdfMoney(section.remaining)} COP`,
      M + this.width / 2,
      this.y + 73,
      this.width / 2 - 16,
      8,
      section.remaining < 0 ? C.amber : C.muted,
      false,
      'right',
    );
    this.y += 108;
  }
  render(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      this.doc.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 15 * 1024 * 1024)
          this.doc.destroy(
            new BadRequestException(
              'El PDF supera 15 MiB; reduce los filtros.',
            ),
          );
        else chunks.push(chunk);
      });
      this.doc.once('error', reject);
      this.doc.once('end', () => resolve(Buffer.concat(chunks)));
      try {
        this.page();
        this.hero();
        for (const section of this.input.sections) {
          if (section.kind === 'fields') this.fields(section);
          else if (section.kind === 'table') this.table(section);
          else if (section.kind === 'budget') this.budget(section);
          else {
            this.heading(section.title);
            this.paragraph(
              section.body,
              section.kind === 'notice' ? 9 : 10,
              section.kind === 'notice' ? C.muted : C.ink,
            );
          }
        }
        const count = this.doc.bufferedPageRange().count;
        for (let page = 0; page < count; page++) {
          this.doc.switchToPage(page);
          const y = this.doc.page.height - 48;
          this.rule(y - 10);
          this.text('EVORIA / Uso interno', M, y, 155, 7.5, C.muted);
          this.text(
            this.input.reference,
            M + 155,
            y,
            this.width - 245,
            7.5,
            C.muted,
          );
          this.text(
            `${page + 1} / ${count}`,
            M + this.width - 70,
            y,
            70,
            8,
            C.navy,
            true,
            'right',
          );
        }
        this.doc.end();
      } catch (error) {
        this.doc.destroy();
        reject(error);
      }
    });
  }
}

export function renderReportPdf(input: ReportPdfDocument): Promise<Buffer> {
  return new CorporateReportPdf(input).render();
}
