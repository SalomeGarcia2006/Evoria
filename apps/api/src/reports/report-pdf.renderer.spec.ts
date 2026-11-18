/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { renderReportPdf, type ReportPdfDocument } from './report-pdf.renderer';

function document(): ReportPdfDocument {
  return {
    title: 'Inventario y disponibilidad',
    subtitle: 'Información de la operación.',
    company: 'Compañía de producción y logística Álvarez S.A.S.',
    nit: '900000001-1',
    generatedAt: new Date('2026-11-18T15:00:00Z'),
    generatedBy: 'Lucía Álvarez',
    reference: 'EV-TEST-001',
    filters: ['Inventario actual'],
    metrics: [{ label: 'Referencias', value: '120' }],
    sections: [
      {
        kind: 'table',
        title: 'Disponibilidad de inventario',
        columns: [
          { label: 'Recurso', weight: 3 },
          { label: 'Estado', weight: 1 },
          { label: 'Unidades disponibles', weight: 1, align: 'right' },
        ],
        rows: Array.from({ length: 120 }, (_, i) => [
          {
            text: `Recurso ${i + 1} - ${'Descripción de un recurso con acentos y ñ. '.repeat((i % 3) + 1)}`,
          },
          { text: 'Disponible' },
          { text: String(i) },
        ]),
      },
    ],
  };
}

test('genera PDF multipágina A4 con fuentes embebidas y metadatos legibles', async () => {
  const bytes = await renderReportPdf(document());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(bytes.includes(Buffer.from('/FontFile2')));
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 3);
  assert.ok(pdf.getPageCount() < 25);
  assert.equal(
    pdf.getTitle(),
    'Inventario y disponibilidad | Compañía de producción y logística Álvarez S.A.S.',
  );
  assert.equal(pdf.getAuthor(), 'Lucía Álvarez');
  for (const page of pdf.getPages()) {
    assert.ok(Math.abs(page.getWidth() - 595.28) < 1);
    assert.ok(Math.abs(page.getHeight() - 841.89) < 1);
  }
});

test('presupuesto cero, tabla vacía y celda extensa producen documentos válidos', async () => {
  const input = document();
  input.sections = [
    {
      kind: 'budget',
      title: 'Presupuesto sin ejecución',
      allocated: 0,
      spent: 0,
      remaining: 0,
    },
    {
      kind: 'table',
      title: 'Sin movimientos',
      columns: [{ label: 'Concepto', weight: 1 }],
      rows: [],
    },
    {
      kind: 'table',
      title: 'Texto extenso',
      columns: [{ label: 'Detalle', weight: 1 }],
      rows: [[{ text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(100) }]],
    },
  ];
  const pdf = await PDFDocument.load(await renderReportPdf(input));
  assert.ok(pdf.getPageCount() > 1);
  assert.ok(pdf.getPageCount() < 10);
});
