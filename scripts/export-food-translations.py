import csv
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

source = Path("docs/food-name-review.csv")
output = Path("food-translations-review.xlsx")

wb = Workbook()
ws = wb.active
ws.title = "Food translations"
ws.append(["English food name", "Arabic translation", "French translation", "Arabic status", "French status"])

with source.open("r", encoding="utf-8-sig", newline="") as handle:
    for row in csv.DictReader(handle):
        ws.append([
            row.get("English food name", ""),
            row.get("Arabic (current translation)", ""),
            row.get("French (current translation)", ""),
            row.get("Arabic translation status", ""),
            row.get("French translation status", ""),
        ])

header_fill = PatternFill("solid", fgColor="1F2937")
for cell in ws[1]:
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal="center", vertical="center")
ws.freeze_panes = "A2"
ws.auto_filter.ref = ws.dimensions
widths = [58, 48, 48, 28, 28]
for index, width in enumerate(widths, start=1):
    ws.column_dimensions[get_column_letter(index)].width = width
for row in ws.iter_rows(min_row=2):
    row[1].alignment = Alignment(horizontal="right", vertical="center")
    row[2].alignment = Alignment(horizontal="left", vertical="center")
ws.sheet_view.rightToLeft = False
wb.save(output)
print(f"Created {output} with {ws.max_row - 1} food names.")
