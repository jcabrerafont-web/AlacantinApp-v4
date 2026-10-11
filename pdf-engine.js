// Motor de Generación y Exportación de PDFs (jsPDF + AutoTable)

// Generar Ficha Individual PDF
function exportarFichaPDF(anilla) {
  const item = ejemplares.find(e => e.anilla === anilla);
  if (!item) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Cabecera PDF
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(18);
  doc.text("CLUB GALLINA ALACANTINA", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("Ficha Oficial Pre-Libro Genealógico (ESGA025)", 14, 25);

  // Datos Criador
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text("DATOS DEL CRIADOR Y EXPLOTACIÓN", 14, 42);
  
  doc.autoTable({
    startY: 46,
    theme: 'plain',
    body: [
      ['Criador Titular:', item.criador],
      ['Código REGA:', item.rega],
      ['Nº Socio del Club:', item.socio]
    ],
    styles: { fontSize: 10 }
  });

  // Datos Ejemplar
  doc.setFontSize(12);
  doc.text("CARACTERÍSTICAS DEL EJEMPLAR", 14, doc.lastAutoTable.finalY + 12);

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 16,
    head: [['Parámetro', 'Valor Registrado']],
    body: [
      ['Anilla Oficial', item.anilla],
      ['Sexo', item.sexo === 'M' ? 'Macho (Gallo)' : 'Hembra (Gallina)'],
      ['Variedad de Pluma', item.variedad],
      ['Año de Nacimiento', item.anyo],
      ['Peso Corporal', item.peso + ' g'],
      ['Anilla del Padre', item.padre],
      ['Anilla de la Madre', item.madre],
      ['Estado de Inspección', item.estado],
      ['Observaciones', item.observaciones || 'Sin observaciones']
    ],
    headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0], fontStyle: 'bold' }
  });

  // Firmas
  const finalY = doc.lastAutoTable.finalY + 30;
  doc.line(14, finalY, 80, finalY);
  doc.text("Firma del Criador", 14, finalY + 5);

  doc.line(130, finalY, 196, finalY);
  doc.text("Firma del Inspector / Club", 130, finalY + 5);

  doc.save(`Ficha_${item.anilla}.pdf`);
}

// Exportar Censo Completo a PDF
function generarPDFCenso() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 297, 25, 'F');
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(16);
  doc.text("CLUB GALLINA ALACANTINA - CENSO OFICIAL PRE-LIBRO ESGA025", 14, 16);

  const tableData = ejemplares.map(e => [
    e.anilla,
    e.sexo === 'M' ? 'Macho' : 'Hembra',
    e.variedad,
    e.anyo,
    e.peso + ' g',
    e.estado,
    e.criador,
    e.socio,
    e.rega
  ]);

  doc.autoTable({
    startY: 30,
    head: [['Anilla', 'Sexo', 'Variedad', 'Año', 'Peso', 'Estado', 'Criador', 'Nº Socio', 'REGA']],
    body: tableData,
    headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9 }
  });

  doc.save("Censo_Oficial_Gallina_Alacantina.pdf");
}