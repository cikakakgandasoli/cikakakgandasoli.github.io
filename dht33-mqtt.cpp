#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// WiFi and MQTT configuration
const char* ssid = "Redmi Note 10s";
const char* password = "elincantik";
const char* mqtt_server = "broker.mqtt-dashboard.com";

// DHT22 configuration
#define DHTPIN 14          // Pin where the DHT22 is connected
#define DHTTYPE DHT22      // DHT 22 (AM2302)

DHT dht(DHTPIN, DHTTYPE);

WiFiClient espClient;
PubSubClient client(espClient);
unsigned long lastMsg = 0;
const unsigned long interval = 2000;  // Publish interval (2 seconds)
char msg[50];

void setup_wifi() {
  Serial.println();
  Serial.printf("Connecting to %s", ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.printf("Message arrived [%s]: ", topic);
  for (unsigned int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println();

  // Control LED from MQTT messages (optional)
  if (payload[0] == '1') {
    digitalWrite(LED_BUILTIN, LOW);   // Turn the LED on
  } else {
    digitalWrite(LED_BUILTIN, HIGH);  // Turn the LED off
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP32Client-" + String(random(0xffff), HEX);

    if (client.connect(clientId.c_str())) {
      Serial.println("connected");
      client.publish("gandasoli/dehydrator/status", "ESP32 connected");
      client.subscribe("gandasoli/dehydrator/commands");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);  // Initialize the BUILTIN_LED pin as an output
  Serial.begin(115200);

  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
  dht.begin();
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  if (now - lastMsg > interval) {
    lastMsg = now;

    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("Failed to read from DHT sensor!");
      return;
    }

    snprintf(msg, sizeof(msg), "{\"temperature\": %.2f, \"humidity\": %.2f}", temperature, humidity);
    Serial.printf("Publishing message: %s\n", msg);

    client.publish("gandasoli/dehydrator/temperature", String(temperature).c_str());
    client.publish("gandasoli/dehydrator/humidity", String(humidity).c_str());
  }
}