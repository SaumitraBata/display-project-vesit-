ACAP SMART DISPLAY - DUAL RASPBERRY PI SETUP
================================================

FILES
-----
1. main.py
   Host PC FastAPI application.
   It keeps the existing Excel API and also forwards every
   selected candidate to the configured ESP32 devices.

2. pi_display.html
   ONE common display file for both Raspberry Pis.

3. esp32_bridge.ino
   ESP32 Wi-Fi -> TCP -> USB Serial bridge.

ARCHITECTURE
------------
Normal Wi-Fi Pi:

Laptop -> Wi-Fi -> Pi -> Display

Modified Pi:

Laptop -> Wi-Fi -> ESP32 -> USB -> Pi -> Display


STEP 1: ESP32
------------
Open esp32_bridge.ino in Arduino IDE.

Change:

const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

Upload it to each ESP32.

Open Serial Monitor at 115200 and note its IP address.


STEP 2: HOST PC
--------------
Open main.py.

Set:

ESP32_IPS = [
    "YOUR_ESP32_IP"
]

If there are two modified Pis, use:

ESP32_IPS = [
    "ESP32_1_IP",
    "ESP32_2_IP"
]

Run the host application normally.

Example:

python main.py


STEP 3: NORMAL WI-FI PI
-----------------------
Open pi_display.html.

Choose:

NORMAL Wi-Fi PI

Enter the host PC IP address.

Example:

192.168.131.10


STEP 4: MODIFIED PI
-------------------
Connect ESP32 to the modified Pi using USB.

The Pi should detect the CP210x serial device.

Open pi_display.html in a Chromium version that supports Web Serial.

Choose:

MODIFIED PI + ESP32

Select:

CP210x USB to UART Bridge

The browser will then read candidate JSON from the ESP32 USB serial connection.


IMPORTANT
---------
The laptop application is started ONLY ONCE.

Every candidate selected on the host is:
- stored in current_student for the normal Wi-Fi Pi
- forwarded to every ESP32 in ESP32_IPS

The ESP32 code does not need to be changed for each candidate.

If an ESP32 is offline, main.py prints an error but the host application
continues running.

For a second modified Pi, add its ESP32 IP to ESP32_IPS.
