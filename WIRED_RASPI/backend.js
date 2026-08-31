// ========================================================
// CONNECTION TARGET
//
// The laptop advertises itself on the network under this mDNS
// hostname (see the zeroconf setup added to WIRELESS_RASPI/main.py),
// so displays never need a manually typed IP address. Only change
// this if you also rename HOSTNAME_LABEL on the host side.
// ========================================================

const WS_HOST = "acap-host.local";
const WS_PORT = 8000;
const RECONNECT_DELAY_MS = 3000;


// ========================================================
// SCREEN SWITCHING
//
// Only one of these is ever visible at a time. Every display
// function below calls this first so screens never overlap.
// ========================================================

function showScreen(id) {
    ["waiting-screen", "data-screen", "seats-screen", "message-screen"].forEach(screenId => {
        document.getElementById(screenId).style.display =
            (screenId === id) ? "block" : "none";
    });
}


// ========================================================
// STUDENT SCREEN
// ========================================================

function displayStudent(data) {

    if (!data) return;

    showScreen("data-screen");

    document.getElementById("display-sno").innerText =
        (data.sno !== undefined && data.sno !== null && data.sno !== "") ? data.sno : "-";

    document.getElementById("display-name").innerText =
        data.name || "-";

    document.getElementById("display-id").innerText =
        data.id || "-";

    document.getElementById("display-category").innerText =
        data.category || "-";
}


// ========================================================
// SEATS SCREEN
//
// data is a dict like {"CMPN": 12, "INFT": 5, ...}. Any
// department not included keeps whatever it last showed,
// so a partial update from the control panel doesn't blank
// out the other five boxes.
// ========================================================

function displaySeats(data) {

    if (!data) return;

    showScreen("seats-screen");

    Object.keys(data).forEach(dept => {
        const el = document.getElementById(`seat-${dept}`);
        if (el) {
            const val = data[dept];
            el.innerText = (val === null || val === undefined || val === "") ? "–" : val;
        }
    });
}


// ========================================================
// MESSAGE SCREEN
// ========================================================

function displayMessage(text) {

    showScreen("message-screen");

    document.getElementById("message-text").innerText = text || "-";
}


// ========================================================
// DISPATCH — routes an incoming payload to the right screen.
//
// Handles both the current typed envelope
//   {"type": "student" | "seats" | "message", "data": ...}
// and the older flat student-only shape, so this keeps
// working even against an un-updated server.
// ========================================================

function handleIncoming(parsed) {

    if (!parsed || typeof parsed !== "object") return;

    if (parsed.type === "student") {
        displayStudent(parsed.data);
    } else if (parsed.type === "seats") {
        displaySeats(parsed.data);
    } else if (parsed.type === "message") {
        displayMessage(parsed.data);
    } else if (
        parsed.category !== undefined &&
        parsed.id !== undefined &&
        parsed.name !== undefined
    ) {
        // Backward-compat: old flat student payload, no "type" wrapper.
        displayStudent(parsed);
    }
}


// ========================================================
// CONNECTION — WebSocket straight to the host over Wi-Fi.
//
// The Pi now has its own WiFi dongle, so there's no more
// ESP32-as-proxy hop: the browser opens the socket itself
// and auto-reconnects if the host restarts or WiFi drops.
// ========================================================

let socket = null;
let reconnectTimer = null;

function setStatus(text) {
    const statusEl = document.getElementById("status");
    if (statusEl) statusEl.innerText = text;
}

function connectWS() {

    setStatus(`Connecting to ${WS_HOST}...`);

    socket = new WebSocket(`ws://${WS_HOST}:${WS_PORT}/ws`);

    socket.onopen = () => {
        setStatus("Connected");
        document.getElementById("setup-screen").style.display = "none";
        showScreen("waiting-screen");
    };

    socket.onmessage = (event) => {
        try {
            const parsed = JSON.parse(event.data);
            handleIncoming(parsed);
        } catch (error) {
            console.log("Bad payload from host:", error);
        }
    };

    socket.onclose = () => {
        document.getElementById("setup-screen").style.display = "block";
        ["waiting-screen", "data-screen", "seats-screen", "message-screen"].forEach(id => {
            document.getElementById(id).style.display = "none";
        });
        setStatus(`Disconnected from ${WS_HOST}. Retrying...`);

        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectWS, RECONNECT_DELAY_MS);
    };

    socket.onerror = () => {
        // onclose fires right after this and handles the retry,
        // so this just avoids an unhandled-error console spam.
        socket.close();
    };
}

window.addEventListener("DOMContentLoaded", connectWS);