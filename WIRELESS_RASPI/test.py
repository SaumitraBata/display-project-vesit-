from pathlib import Path

py_path = Path("WIRELESS_RASPI/main.py")
js_path = Path("WIRELESS_RASPI/static/script.js")

py = py_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

# --- Backend: use the actual Excel sheet row number ---
old_py = """        for _, row in df_raw.iterrows():
            row_vals = [
                str(val).strip() if pd.notna(val) else ""
                for val in row
            ]"""
new_py = """        for excel_row_index, row in df_raw.iterrows():
            # df_raw still retains the original Excel row index even after
            # dropping completely empty rows. Convert pandas' 0-based index
            # to the actual 1-based Excel row number.
            excel_row_number = int(excel_row_index) + 1

            row_vals = [
                str(val).strip() if pd.notna(val) else ""
                for val in row
            ]"""
if old_py not in py:
    raise RuntimeError("Could not find the expected row-iteration block in the Python file.")
py = py.replace(old_py, new_py)

old_py2 = """                        row_counter += 1
                        row_dict = {
                            current_headers[i]: row_data[i]
                            for i in range(len(row_data))
                        }
                        row_dict["Sr. No"] = row_counter
                        current_rows.append(row_dict)"""
new_py2 = """                        row_dict = {
                            current_headers[i]: row_data[i]
                            for i in range(len(row_data))
                        }

                        # Serial number = the physical row position in the
                        # Excel sheet, not the position within the table.
                        row_dict["Sr. No"] = excel_row_number
                        current_rows.append(row_dict)"""
if old_py2 not in py:
    raise RuntimeError("Could not find the expected serial-number block in the Python file.")
py = py.replace(old_py2, new_py2)

# Remove the now-unused global counter and update the related comment.
py = py.replace(
    """            row_counter = 0

            for excel_row_index, row in df_raw.iterrows():""",
    """            for excel_row_index, row in df_raw.iterrows():"""
)
py = py.replace(
    """                    # NOTE: row_counter is NOT reset here — Sr. No tracks
                    # each entry's position in the sheet as a whole, not
                    # its position within just this table.""",
    """                    # Sr. No is based on the original Excel row position,
                    # so it naturally remains correct across multiple tables."""
)

# Fallback path: pandas' default header consumes Excel row 1,
# so the first data record is Excel row 2.
old_py3 = """            rows = df.to_dict(orient="records")
            for i, row_dict in enumerate(rows, start=1):
                row_dict["Sr. No"] = i"""
new_py3 = """            rows = df.to_dict(orient="records")
            for i, row_dict in enumerate(rows, start=2):
                # The normal pandas read uses the first Excel row as the
                # header, so data rows start at Excel row 2.
                row_dict["Sr. No"] = i"""
if old_py3 not in py:
    raise RuntimeError("Could not find the expected fallback serial-number block.")
py = py.replace(old_py3, new_py3)

# --- Frontend: send the synthetic backend serial number ---
old_js = """        sno: rowData['Serial no.'] ?? 'N/A'"""
new_js = """        // The backend sets this to the actual Excel sheet row number.
        sno: rowData['Sr. No'] ?? 'N/A'"""
if old_js not in js:
    raise RuntimeError("Could not find the expected sno mapping in the JS file.")
js = js.replace(old_js, new_js)

out_py = Path("/mnt/data/Pasted code_updated.py")
out_js = Path("/mnt/data/Pasted code (2)_updated.js")
out_py.write_text(py, encoding="utf-8")
out_js.write_text(js, encoding="utf-8")

print(f"Created: {out_py}")
print(f"Created: {out_js}")
print("\nKey behavior:")
print("- A student physically on Excel row 7 gets Sr. No = 7.")
print("- Empty rows do not shift the serial number.")
print("- Multiple detected tables continue using the actual sheet row.")
print("- The JS now sends the backend's 'Sr. No' value instead of looking for 'Serial no.'.")
