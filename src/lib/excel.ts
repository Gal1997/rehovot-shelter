import { formatDateHe } from "./dates";

function xml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cell(value: unknown) {
  return `<Cell><Data ss:Type="String">${xml(value)}</Data></Cell>`;
}

function worksheet(name: string, headers: string[], rows: unknown[][]) {
  return `<Worksheet ss:Name="${xml(name)}"><Table><Row ss:StyleID="header">${headers
    .map((header) => cell(header))
    .join("")}</Row>${rows
    .map((row) => `<Row>${row.map((value) => cell(value)).join("")}</Row>`)
    .join("")}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><DisplayRightToLeft/></WorksheetOptions></Worksheet>`;
}

export function buildWorkbook(sheets: { name: string; headers: string[]; rows: unknown[][] }[]) {
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Font ss:FontName="Arial" ss:Size="11"/></Style><Style ss:ID="header"><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#3F7D6B" ss:Pattern="Solid"/><Alignment ss:Horizontal="Right"/></Style></Styles>${sheets
    .map((sheet) => worksheet(sheet.name, sheet.headers, sheet.rows))
    .join("")}</Workbook>`;
}

export function dateCell(value: string | null | undefined) {
  return value ? formatDateHe(value) : "";
}
