import jsPDF from "jspdf";
import { brl, dateBR } from "@/lib/format";

export type ReceiptInput = {
  receiptNumber: string;
  companyName: string;
  companyEmail?: string | null;
  companySlug?: string | null;
  amount: number;
  paidAt: string;
  note?: string | null;
  platformName?: string;
  pixHolder?: string | null;
  pixKey?: string | null;
};

export function generatePaymentReceipt(input: ReceiptInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const platform = input.platformName ?? "BeautySaaS";

  // Header
  doc.setFillColor(30, 27, 24);
  doc.rect(0, 0, w, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(platform, 15, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Comprovante de Pagamento", 15, 22);
  doc.setFontSize(9);
  doc.text(`Nº ${input.receiptNumber}`, w - 15, 14, { align: "right" });
  doc.text(`Emitido em ${dateBR(new Date().toISOString())}`, w - 15, 20, { align: "right" });

  doc.setTextColor(20, 20, 20);
  let y = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Contratante", 15, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y += 6;
  doc.text(input.companyName, 15, y);
  if (input.companyEmail) { y += 5; doc.text(`E-mail: ${input.companyEmail}`, 15, y); }
  if (input.companySlug) { y += 5; doc.text(`Identificador: /${input.companySlug}`, 15, y); }

  y += 12;
  doc.setDrawColor(220, 220, 220);
  doc.line(15, y, w - 15, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Detalhes do pagamento", 15, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const rows: [string, string][] = [
    ["Descrição", "Mensalidade da Plataforma"],
    ["Valor pago", brl(input.amount)],
    ["Data do pagamento", dateBR(input.paidAt)],
    ["Forma de pagamento", "PIX"],
  ];
  if (input.pixHolder) rows.push(["Titular PIX", input.pixHolder]);
  if (input.pixKey) rows.push(["Chave PIX", input.pixKey]);
  if (input.note) rows.push(["Observação", input.note]);

  rows.forEach(([k, v]) => {
    doc.setTextColor(110, 110, 110);
    doc.text(k, 15, y);
    doc.setTextColor(20, 20, 20);
    doc.text(String(v), 70, y);
    y += 7;
  });

  y += 6;
  doc.setDrawColor(220, 220, 220);
  doc.line(15, y, w - 15, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 27, 24);
  doc.text(`TOTAL PAGO: ${brl(input.amount)}`, 15, y);

  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const disclaimer =
    "Este documento é o comprovante oficial de pagamento da mensalidade da plataforma " +
    platform + ", emitido conforme os Termos de Uso e Contratação aceitos pelo contratante. " +
    "Guarde-o para fins fiscais e de conferência.";
  const lines = doc.splitTextToSize(disclaimer, w - 30);
  doc.text(lines, 15, y);

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`${platform} • comprovante gerado automaticamente`, w / 2, 285, { align: "center" });

  doc.save(`comprovante-${input.receiptNumber}.pdf`);
}
