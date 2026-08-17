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
// MODE 1: NORMAL RASPBERRY PI WITH WI-FI
// ========================================================

function connectLaptop() {

    const ip =
        document.getElementById("ip-input")
        .value
        .trim();

    if (!ip) {
        document.getElementById("status").innerText =
            "Enter the laptop IP address first.";
        return;
    }

    const targetUrl =
        `http://${ip}:8000/api/current_student`;

    document.getElementById("setup-screen").style.display =
        "none";

    document.getElementById("waiting-screen").style.display =
        "block";

    setInterval(async () => {

        try {

            const response =
                await fetch(targetUrl);

            if (!response.ok)
                throw new Error("HTTP error");

            const data =
                await response.json();

            handleIncoming(data);

        } catch (error) {

            console.log(
                "Laptop connection error:",
                error
            );

        }

    }, 1000);
}


// ========================================================
// MODE 2: MODIFIED RPI + ESP32
//
// ESP32 is connected to the Pi through USB.
// Chromium Web Serial reads /dev/ttyUSB0 through the
// CP210x USB-UART interface.
// ========================================================

async function connectESP32() {

    try {

        if (!("serial" in navigator)) {

            document.getElementById("status").innerText =
                "This Chromium version does not support Web Serial.";

            return;
        }

        const port =
            await navigator.serial.requestPort();

        await port.open({
            baudRate: 115200
        });

        document.getElementById("setup-screen").style.display =
            "none";

        document.getElementById("waiting-screen").style.display =
            "block";

        document.getElementById("status").innerText =
            "Connected to ESP32";

        const decoder =
            new TextDecoderStream();

        port.readable.pipeTo(
            decoder.writable
        );

        const reader =
            decoder.readable.getReader();

        let buffer = "";

        while (true) {

            const { value, done } =
                await reader.read();

            if (done) break;

            buffer += value;

            const lines =
                buffer.split("\n");

            buffer = lines.pop();

            for (let line of lines) {

                line = line.trim();

                if (!line) continue;

                console.log(
                    "ESP32:",
                    line
                );

                try {

                    const data =
                        JSON.parse(line);

                    handleIncoming(data);

                } catch (error) {

                    // Ignore non-JSON ESP32 messages.
                }
            }
        }

    } catch (error) {

        console.error(
            "ESP32 connection error:",
            error
        );

        document.getElementById("status").innerText =
            "Could not connect to ESP32: " + error;
    }
}