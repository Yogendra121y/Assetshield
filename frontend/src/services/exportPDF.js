import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function exportPDF(assets) {
  const doc = new jsPDF()

  // Header
  doc.setFillColor(26, 68, 245)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('ASSETSHIELD AI — Digital Asset Protection Report', 14, 18)

  // Date
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 38)

  // Summary stats
  const safe       = assets.filter(a => a.status === 'safe').length
  const flagged    = assets.filter(a => a.status === 'flagged').length
  const processing = assets.filter(a => a.status === 'processing').length

  doc.setTextColor(30, 30, 30)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary', 14, 50)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Total Assets: ${assets.length}   Safe: ${safe}   Flagged: ${flagged}   Processing: ${processing}`, 14, 58)

  // Table
  autoTable(doc, {
    startY: 66,
    head: [['File Name', 'Status', 'Similarity', 'Fingerprint', 'Uploaded']],
    body: assets.map(a => [
      a.fileName || 'Untitled',
      (a.status || 'processing').toUpperCase(),
      typeof a.similarityScore === 'number' ? `${a.similarityScore}%` : '—',
      a.fingerprint ? a.fingerprint.slice(0, 16) + '…' : '—',
      a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString() : '—',
    ]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [26, 68, 245], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 255] },
    columnStyles: {
      1: { fontStyle: 'bold' },
    },
    didParseCell(data) {
      if (data.column.index === 1 && data.section === 'body') {
        if (data.cell.raw === 'FLAGGED')    data.cell.styles.textColor = [220, 38, 38]
        if (data.cell.raw === 'SAFE')       data.cell.styles.textColor = [16, 185, 129]
        if (data.cell.raw === 'PROCESSING') data.cell.styles.textColor = [245, 158, 11]
      }
    },
  })

  doc.save('assetshield-ai-report.pdf')
}
