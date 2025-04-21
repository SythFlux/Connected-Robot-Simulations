#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>

// WiFi credentials
const char* ssid = "AIP";
const char* password = "Tresax123@";

// MQTT broker settings
const char* mqtt_server = "192.168.9.185";
const int mqtt_port = 1883; // TCP port for MQTT
const char* mqtt_user = "user";
const char* mqtt_pass = "user123";

// Robot target
String targetRobot = "robot_1";

// Pins
#define BTN_PIN 34
#define LED_NORTH 32
#define LED_EAST 26
#define LED_SOUTH 27
#define LED_WEST 12

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

// Button debounce
bool lastButtonState = HIGH;
bool buttonPressed = false;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50;

void setupWiFi() {
  WiFi.disconnect(true);
  delay(1000);
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected: ");
  Serial.println(WiFi.localIP());
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.printf("MQTT Message [%s]: ", topic);
  String msg(payload, length);
  Serial.println(msg);

  DynamicJsonDocument doc(512);
  auto err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.print("JSON Error: ");
    Serial.println(err.c_str());
    return;
  }

  if (doc["sender"].as<String>() != targetRobot) return;
  if (doc["type"].as<String>() != "position_update") return;

  String dir = doc["data"]["direction"];
  Serial.print("Direction: ");
  Serial.println(dir);

  digitalWrite(LED_NORTH, dir == "north");
  digitalWrite(LED_EAST,  dir == "east");
  digitalWrite(LED_SOUTH, dir == "south");
  digitalWrite(LED_WEST,  dir == "west");
}

void sendEmergencyStop() {
  Serial.println("EMERGENCY STOP");

  DynamicJsonDocument doc(256);
  doc["type"] = "stop_all";
  doc["version"] = "1.3";
  doc["timestamp"] = time(NULL);
  doc["sender"] = targetRobot;
  doc["data"]["all"] = true;  // Using an object with "all": true

  char payload[256];
  serializeJson(doc, payload);

  // ✅ Print the actual serialized JSON to verify it's correct
  Serial.print("Serialized payload: ");
  Serial.println(payload);

  mqttClient.publish("server/broadcast", payload);
  Serial.println("Sent to topic server/broadcast");
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (mqttClient.connect("esp32_dashboard", mqtt_user, mqtt_pass)) {
      Serial.println("connected");
      mqttClient.subscribe("robots/position_updates");
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retrying in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(100);

  pinMode(BTN_PIN, INPUT_PULLUP);
  pinMode(LED_NORTH, OUTPUT);
  pinMode(LED_EAST, OUTPUT);
  pinMode(LED_SOUTH, OUTPUT);
  pinMode(LED_WEST, OUTPUT);

  setupWiFi();

  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(mqttCallback);

  reconnectMQTT();
}

void loop() {
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }

  mqttClient.loop();

  // Button press debounce logic
  bool reading = digitalRead(BTN_PIN);
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
    lastButtonState = reading;
  }

  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading == LOW && !buttonPressed) {
      buttonPressed = true;
      sendEmergencyStop();
    } else if (reading == HIGH) {
      buttonPressed = false;
    }
  }
}
