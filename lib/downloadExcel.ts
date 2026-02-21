import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export type ComputoRow = {
  codice?: string;
  categoria: string;
  descrizione: string;
  um: string;
  quantita: number;
  prezzo_unitario?: string | number;
};

export async function downloadComputoExcel(
  data: ComputoRow[],
  isPrezzarioMode: boolean,
  includePrices: boolean = true
) {
  if (data.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Computo");

  if (isPrezzarioMode) {
    worksheet.columns = [
      { header: "Codice Ufficiale", key: "codice", width: 18 },
      { header: "Categoria", key: "categoria", width: 25 },
      { header: "Descrizione Tecnica", key: "descrizione", width: 80 },
      { header: "U.M.", key: "um", width: 8 },
      { header: "Quantità", key: "quantita", width: 12 },
      { header: "Prezzo Unitario (€)", key: "prezzo", width: 18 },
      { header: "Totale (€)", key: "totale", width: 18 },
    ];
  } else {
    worksheet.columns = [
      { header: "Categoria", key: "categoria", width: 25 },
      { header: "Descrizione Tecnica", key: "descrizione", width: 80 },
      { header: "U.M.", key: "um", width: 8 },
      { header: "Quantità", key: "quantita", width: 12 },
    ];
  }

  data.forEach((item) => {
    if (isPrezzarioMode) {
      const isDaCercare =
        String(item.prezzo_unitario ?? "").toUpperCase() === "DA CERCARE";
      const prezzo = parseFloat(String(item.prezzo_unitario ?? "")) || 0;
      const quantita = parseFloat(String(item.quantita ?? 0)) || 0;
      const totale = (prezzo * quantita).toFixed(2);
      worksheet.addRow({
        codice: item.codice || "",
        categoria: item.categoria || "",
        descrizione: item.descrizione || "",
        um: item.um || "",
        quantita,
        prezzo: includePrices
          ? isDaCercare
            ? "DA CERCARE"
            : prezzo > 0
              ? prezzo
              : ""
          : "",
        totale: includePrices
          ? isDaCercare
            ? "DA CERCARE"
            : prezzo > 0
              ? parseFloat(totale)
              : ""
          : "",
      });
    } else {
      worksheet.addRow({
        categoria: item.categoria || "",
        descrizione: item.descrizione || "",
        um: item.um || "",
        quantita: item.quantita ?? 1,
      });
    }
  });

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.alignment = { wrapText: true, vertical: "top" as const };
      if (rowNumber === 1) {
        cell.font = { bold: true };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, "Computo_Metrico_Professionale.xlsx");
}
