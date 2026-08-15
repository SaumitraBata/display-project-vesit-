// ========================================================
// COMMON DISPLAY FUNCTION
// ========================================================

function displayStudent(data) {

    if (!data) return;

    document.getElementById("waiting-screen").style.display = "none";
    document.getElementById("data-screen").style.display = "block";

    document.getElementById("display-name").innerText =
        data.name || "-";

    document.getElementById("display-id").innerText =
        data.id || "-";

    document.getElementById("display-category").innerText =
        data.category || "-";
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

            if (data && data.name) {
                displayStudent(data);
            }

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

                    // Only process our candidate JSON.
                    if (
                        data.category !== undefined &&
                        data.id !== undefined &&
                        data.name !== undefined
                    ) {
                        displayStudent(data);
                    }

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