#include <WiFi.h>

// ============================================================
// ESP32 Wi-Fi configuration
// ============================================================

const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

// TCP server used by the host PC
WiFiServer server(5000);


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

  server.begin();

  Serial.println("TCP server started on port 5000");
}


void loop() {

  WiFiClient client = server.available();

  if (!client) {
    return;
  }

  Serial.println("Laptop connected!");

  while (client.connected()) {

    if (client.available()) {

      String data =
          client.readStringUntil('\n');

      data.trim();

      if (data.length() > 0) {

        Serial.print("Received from laptop: ");
        Serial.println(data);

        // Forward candidate JSON to Raspberry Pi
        Serial.println(data);
      }
    }
  }

  client.stop();

  Serial.println("Laptop disconnected.");
}
