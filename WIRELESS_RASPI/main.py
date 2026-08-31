from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from zeroconf import ServiceInfo
from zeroconf.asyncio import AsyncZeroconf
from contextlib import asynccontextmanager
import pandas as pd
import io
import json
import socket

# ============================================================
# mDNS HOSTNAME (no more typing an IP into the display client)
#
# This laptop advertises itself on the local network as
# HOSTNAME_LABEL + ".local" using zeroconf, which implements
# mDNS itself rather than relying on OS-level Bonjour/Avahi —
# so it works the same on Windows, macOS, and Linux. Any
# display on the same WiFi (Raspberry Pi OS resolves .local
# names out of the box) can then reach it at a fixed address
# that never needs updating, even if the laptop's IP changes.
#
# WIRED_RASPI/backend.js points at this same hostname via
# WS_HOST — keep the two in sync if you ever rename it.
#
# Uses zeroconf's ASYNC API specifically (AsyncZeroconf), run
# inside FastAPI's own event loop via lifespan. The sync
# Zeroconf() class spins up its own background thread with its
# own event loop, which on Windows fights with uvicorn's loop
# and throws EventLoopBlocked — the async API avoids that
# entirely since it shares the loop FastAPI is already running.
# ============================================================
HOSTNAME_LABEL = "acap-host"


def _get_local_ip() -> str:
    """Finds this machine's LAN IP without actually sending any
    traffic — connect() on a UDP socket just asks the OS to pick
    the interface/route that would be used."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    local_ip = _get_local_ip()

    service_info = ServiceInfo(
        "_acap._tcp.local.",
        f"{HOSTNAME_LABEL}._acap._tcp.local.",
        addresses=[socket.inet_aton(local_ip)],
        port=8000,
        server=f"{HOSTNAME_LABEL}.local.",
    )

    azeroconf = AsyncZeroconf()
    await azeroconf.async_register_service(service_info)

    print(f"Advertising as {HOSTNAME_LABEL}.local ({local_ip}) via mDNS")

    yield

    await azeroconf.async_unregister_service(service_info)
    await azeroconf.async_close()


app = FastAPI(title="Student Excel Data Viewer", lifespan=lifespan)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

DEPARTMENTS = ["CMPN", "INFT", "AURO", "EXTC", "AIDS", "ECS"]

# Column headers vary slightly depending on how the source sheet was
# formatted, so accept any of these and normalize to "sno" — the key
# WIRED_RASPI/backend.js actually reads.
SNO_KEYS = ["sno", "Sno", "SNo", "Sr. No", "Sr.No", "Sr No", "SrNo", "S.No", "S.No.", "Serial No", "Serial Number"]


def _extract_sno(payload: dict):
    for key in SNO_KEYS:
        if key in payload and payload[key] != "":
            return payload[key]
    return None

current_student = {}
current_seats = {dept: None for dept in DEPARTMENTS}
current_message = ""
current_view = "student"  # "student" | "seats" | "message" — whichever the client should show right now

active_connections = set()

# Allow the display clients to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


@app.post("/api/upload")
async def upload_excel(file: UploadFile = File(...)):
    if not file.filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid Excel or CSV file."
        )

    contents = await file.read()

    try:
        if file.filename.endswith(".csv"):
            df_raw = pd.read_csv(io.BytesIO(contents), header=None)
        else:
            df_raw = pd.read_excel(io.BytesIO(contents), header=None)

        df_raw = df_raw.dropna(how="all").dropna(how="all", axis=1)

        tables = []
        current_headers = None
        current_rows = []
        row_counter = 0

        for _, row in df_raw.iterrows():
            row_vals = [
                str(val).strip() if pd.notna(val) else ""
                for val in row
            ]

            if not any(row_vals):
                continue

            is_header = any(
                "registration" in str(v).lower()
                or "candidatur" in str(v).lower()
                for v in row_vals
            )

            if is_header:
                if current_headers and current_rows:
                    tables.append({
                        "headers": current_headers,
                        "rows": current_rows
                    })
                    current_rows = []
                    row_counter = 0

                current_headers = [
                    v.replace("\n", " ")
                    for v in row_vals
                    if v != ""
                ]

            else:
                if current_headers:
                    row_data = row_vals[:len(current_headers)]

                    if any(row_data):
                        row_counter += 1
                        row_dict = {
                            current_headers[i]: row_data[i]
                            for i in range(len(row_data))
                        }
                        row_dict["Sr. No"] = row_counter
                        current_rows.append(row_dict)

        if current_headers and current_rows:
            tables.append({
                "headers": current_headers,
                "rows": current_rows
            })

        if not tables:
            df = pd.read_excel(
                io.BytesIO(contents)
            ).fillna("")

            df.columns = [
                str(c).replace("\n", " ").strip()
                for c in df.columns
            ]

            rows = df.to_dict(orient="records")
            for i, row_dict in enumerate(rows, start=1):
                row_dict["Sr. No"] = i

            tables.append({
                "headers": list(df.columns),
                "rows": rows
            })

        return {
            "status": "success",
            "tables": tables
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}"
        )


def current_payload() -> dict:
    """Whatever the client should be showing right now, in the typed
    envelope every screen (student / seats / message) shares."""
    if current_view == "seats":
        return {"type": "seats", "data": current_seats}
    if current_view == "message":
        return {"type": "message", "data": current_message}
    return {"type": "student", "data": current_student}


async def broadcast(payload: dict):
    global active_connections

    dead = set()
    for ws in active_connections:
        try:
            await ws.send_json(payload)
        except Exception:
            print("Disconnected!")
            dead.add(ws)
    active_connections -= dead


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    global active_connections

    await websocket.accept()
    active_connections.add(websocket)
    print("New Connection!")
    await websocket.send_json(current_payload())  # send current state on connect
    try:
        while True:
            await websocket.receive_text()  # keep alive / handle pings
    except WebSocketDisconnect:
        active_connections.discard(websocket)


@app.post("/api/update_student")
async def update_student(payload: dict):
    global current_student, current_view

    current_student = dict(payload)

    if "sno" not in current_student:
        sno = _extract_sno(payload)
        if sno is not None:
            current_student["sno"] = sno

    current_view = "student"
    print("Selected candidate:", current_student)

    await broadcast({"type": "student", "data": current_student})

    return {
        "status": 200,
        "student": current_student
    }


@app.post("/api/update_seats")
async def update_seats(payload: dict):
    """Body: any subset of {"CMPN": 12, "INFT": 5, ...}. Unknown keys are
    ignored so a stray column from the client can't silently add a
    seventh box."""
    global current_seats, current_view

    for dept in DEPARTMENTS:
        if dept in payload:
            current_seats[dept] = payload[dept]

    current_view = "seats"
    print("Seat counts updated:", current_seats)

    await broadcast({"type": "seats", "data": current_seats})

    return {
        "status": 200,
        "seats": current_seats
    }


@app.post("/api/update_message")
async def update_message(payload: dict):
    """Body: {"text": "Break"}"""
    global current_message, current_view

    current_message = str(payload.get("text", "")).strip()
    current_view = "message"
    print("Message updated:", current_message)

    await broadcast({"type": "message", "data": current_message})

    return {
        "status": 200,
        "message": current_message
    }


@app.post("/api/show_student")
async def show_student():
    """Switches the client back to the merit-list/candidate view without
    changing the stored candidate — used by the control panel's
    'Merit List' tab to snap displays back after Seats/Message."""
    global current_view

    current_view = "student"
    await broadcast({"type": "student", "data": current_student})

    return {
        "status": 200,
        "student": current_student
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False
    )