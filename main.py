from fastapi import FastAPI, UploadFile, File, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles # <-- Import this
import pandas as pd
import io


app = FastAPI(title="Student Excel Data Viewer")


app = FastAPI(title="Student Excel Data Viewer")

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

@app.post("/api/upload")
async def upload_excel(file: UploadFile = File(...)):
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Please upload a valid Excel or CSV file.")

    contents = await file.read()
    
    try:
        if file.filename.endswith('.csv'):
            df_raw = pd.read_csv(io.BytesIO(contents), header=None)
        else:
            df_raw = pd.read_excel(io.BytesIO(contents), header=None)

        # Drop entirely empty rows and columns
        df_raw = df_raw.dropna(how='all').dropna(how='all', axis=1)

        # Parse tables (handling potential repeated headers like CET/JEE blocks)
        tables = []
        current_headers = None
        current_rows = []

        for _, row in df_raw.iterrows():
            row_vals = [str(val).strip() if pd.notna(val) else "" for val in row]
            
            # Skip empty lines
            if not any(row_vals):
                continue

            # Detect header row (e.g., contains 'Registration Id' or 'Name')
            is_header = any("registration" in str(v).lower() or "candidatur" in str(v).lower() for v in row_vals)

            if is_header:
                if current_headers and current_rows:
                    tables.append({"headers": current_headers, "rows": current_rows})
                    current_rows = []
                current_headers = [v.replace('\n', ' ') for v in row_vals if v != ""]
            else:
                if current_headers:
                    # Match row data length with header length
                    row_data = row_vals[:len(current_headers)]
                    if any(row_data):
                        row_dict = {current_headers[i]: row_data[i] for i in range(len(row_data))}
                        current_rows.append(row_dict)

        if current_headers and current_rows:
            tables.append({"headers": current_headers, "rows": current_rows})

        # Fallback if no specific header pattern was found
        if not tables:
            df = pd.read_excel(io.BytesIO(contents)).fillna("")
            df.columns = [str(c).replace('\n', ' ').strip() for c in df.columns]
            tables.append({
                "headers": list(df.columns),
                "rows": df.to_dict(orient="records")
            })

        return {"status": "success", "tables": tables}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)