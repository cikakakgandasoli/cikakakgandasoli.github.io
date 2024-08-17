#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// WiFi credentials
const char* ssid = "your-SSID";
const char* password = "your-PASSWORD";

// MQTT Broker settings
const char* mqtt_server = "broker.hivemq.com"; // or your broker address
const int mqtt_port = 8000;
const char* mqtt_user = "your-MQTT-USERNAME"; // if required
const char* mqtt_password = "your-MQTT-PASSWORD"; // if required
const char* temperature_topic = "gandasoli/dehydrator/temperature";
const char* humidity_topic = "gandasoli/dehydrator/humidity";
const char* control_topic = "gandasoli/dehydrator/control";

WiFiClient espClient;
PubSubClient client(espClient);

// DHT Sensor settings
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// SCR Control
#define SCR_PIN 14
int pwmValue = 0;

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  dht.begin();

  pinMode(SCR_PIN, OUTPUT);
  ledcSetup(0, 5000, 8); // PWM channel 0, 5kHz frequency, 8-bit resolution
  ledcAttachPin(SCR_PIN, 0); // Attach SCR_PIN to PWM channel 0
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Attempt to connect
    if (client.connect("ESP32Client", mqtt_user, mqtt_password)) {
      Serial.println("connected");
      // Subscribe to control topic
      client.subscribe(control_topic);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("Message received: ");
  Serial.println(message);

  // Control logic based on received MQTT message
  if (String(topic) == control_topic) {
    pwmValue = message.toInt();
    ledcWrite(0, pwmValue); // Set PWM value to control SCR
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Read temperature and humidity
  float h = dht.readHumidity();
  float t = dht.readTemperature();

  if (isnan(h) || isnan(t)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }

  // Publish temperature and humidity data to MQTT topics
  client.publish(temperature_topic, String(t).c_str(), true);
  client.publish(humidity_topic, String(h).c_str(), true);

  Example control logic based on temperature
  if (t > 30) {
    pwmValue = 255; // Full power if temperature is above 30°C
  } else if (t < 25) {
    pwmValue = 0;   // No power if temperature is below 25°C
  } else {
    pwmValue = map(t, 25, 30, 0, 255); // Linear PWM control
  }
  ledcWrite(0, pwmValue); // Apply PWM to SCR

  delay(2000); // Delay for 2 seconds
}
