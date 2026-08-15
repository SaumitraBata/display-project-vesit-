#include <WiFi.h>
#include <WebSocketsClient.h>

// ============================================================
// ESP32 Wi-Fi + WebSocket configuration
// ============================================================

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

const char* wsHost = "YOUR_HOST_IP";  // Pi A's IP
const uint16_t wsPort = 8000;          // FastAPI/uvicorn port
const char* wsPath = "/ws";

WebSocketsClient webSocket;

// ============================================================
// WebSocket event handler
// ============================================================
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {

  switch (type) {

    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected from Pi A");
      break;

    case WStype_CONNECTED:
      Serial.println("[WS] Connected to Pi A");
      break;

    case WStype_TEXT: {
      // Forward payload to Pi B over UART, same shape as your old code
      String data = String((char*)payload);
      data.trim();

      if (data.length() > 0) {
        // Forward JSON to Raspberry Pi B
        Serial.println(data);
      }
      break;
    }

    case WStype_ERROR:
      Serial.println("[WS] Error");
      break;

    default:
      break;
  }
}

void setup() {

  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("Starting ESP32...");

  WiFi.begin(ssid, password);

  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("Wi-Fi connected!");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());

  // Connect to FastAPI's /ws endpoint
  webSocket.begin(wsHost, wsPort, wsPath);
  webSocket.onEvent(webSocketEvent);

  // Auto-reconnect with backoff (5s retry interval)
  webSocket.setReconnectInterval(5000);

  // Heartbeat: ping every 20s, expect pong within 3s, else reconnect
  // webSocket.enableHeartbeat(20000, 3000, 2);

  Serial.println("WebSocket client started, connecting to Pi A...");
}

void loop() {
  webSocket.loop();  // must be called continuously, non-blocking
}