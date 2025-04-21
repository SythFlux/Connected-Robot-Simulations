from controller import Robot, Supervisor
import time
import json
import heapq
import random
import threading
import paho.mqtt.client as mqtt

robot = Supervisor()
translationfield = robot.getSelf().getField('translation')
timestep = int(robot.getBasicTimeStep())

TILE_SIZE = 0.1
obstacle_tiles = set()
published_obstacles = set()
robot_name = "robot_1"
current_task = None
PROTOCOL_VERSION = "1.3"
stop_requested = False
address = "192.168.9.185"
# Devices
sensors = {
    "north": robot.getDevice("ds_north"),
    "south": robot.getDevice("ds_south"),
    "east": robot.getDevice("ds_east"),
    "west": robot.getDevice("ds_west")
}
for s in sensors.values():
    s.enable(timestep)

leds = {
    "north": robot.getDevice("north"),
    "south": robot.getDevice("south"),
    "east": robot.getDevice("east"),
    "west": robot.getDevice("west")
}
for l in leds.values():
    l.set(0)

# MQTT setup (WebSocket)
mqtt_client = mqtt.Client(transport="websockets")
mqtt_client.username_pw_set("user", "user123")

def send_mqtt(topic, msg_type, data):
    msg = {
        "sender": robot_name,
        "type": msg_type,
        "version": PROTOCOL_VERSION,
        "timestamp": int(time.time()),
        "data": data
    }
    payload = json.dumps(msg)
    mqtt_client.publish(topic, payload)        # WebSocket client
    tcp_mqtt_client.publish(topic, payload)    # TCP client
    print(f"MQTT Sent to {topic}: {msg}")


def move_by_tile(dx, dy, steps=20):
    current = translationfield.getSFVec3f()
    target = [current[0] + dx * TILE_SIZE, current[1] + dy * TILE_SIZE, 0.05]
    delta = [(target[i] - current[i]) / steps for i in range(3)]
    for _ in range(steps):
        current = [current[i] + delta[i] for i in range(3)]
        translationfield.setSFVec3f(current)
        if robot.step(timestep) == -1:
            break

def get_tile():
    pos = translationfield.getSFVec3f()
    return round(pos[0] / TILE_SIZE), round(pos[1] / TILE_SIZE)

def scan_obstacles(x, y):
    sensor_values = {k: v.getValue() for k, v in sensors.items()}
    print("Sensor values:", sensor_values)

    if sensor_values["north"] < 960: obstacle_tiles.add((x, y + 1))
    if sensor_values["south"] < 960: obstacle_tiles.add((x, y - 1))
    if sensor_values["east"] < 960: obstacle_tiles.add((x + 1, y))
    if sensor_values["west"] < 960: obstacle_tiles.add((x - 1, y))

    for tile in obstacle_tiles - published_obstacles:
        send_mqtt("robots/obstacles", "obstacle_detected", {
            "x": tile[0],
            "y": tile[1],
            "obstacle_type": "wall"
        })
        published_obstacles.add(tile)

def a_star(start, goal):
    open_set = []
    heapq.heappush(open_set, (0, start))
    came_from = {}
    g_score = {start: 0}

    def heuristic(a, b): return abs(a[0] - b[0]) + abs(a[1] - b[1])

    while open_set:
        _, current = heapq.heappop(open_set)
        if current == goal:
            path = []
            while current in came_from:
                path.append(current)
                current = came_from[current]
            path.reverse()
            return path

        for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
            neighbor = (current[0] + dx, current[1] + dy)
            if neighbor in obstacle_tiles:
                continue
            tentative_g = g_score[current] + 1
            if neighbor not in g_score or tentative_g < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                heapq.heappush(open_set, (tentative_g + heuristic(neighbor, goal), neighbor))

    return []

def move_stepwise_to(goal_x, goal_y):
    global stop_requested
    current_x, current_y = get_tile()

    while (current_x, current_y) != (goal_x, goal_y):
        if stop_requested:
            print("Stop requested. Halting after current tile.")
            break

        scan_obstacles(current_x, current_y)
        path = a_star((current_x, current_y), (goal_x, goal_y))

        if not path:
            send_mqtt("robots/errors", "error", {
                "error_code": 400,
                "error_message": f"No path to ({goal_x}, {goal_y}) from ({current_x}, {current_y})"
            })
            return

        next_x, next_y = path[0]
        dx, dy = next_x - current_x, next_y - current_y

        direction = ""
        if dx == 1: direction = "east"
        elif dx == -1: direction = "west"
        elif dy == 1: direction = "north"
        elif dy == -1: direction = "south"

        print(f"Moving to ({next_x}, {next_y}) → {direction}")
        if direction in leds:
            leds[direction].set(1)

        move_by_tile(dx, dy)
        current_x, current_y = next_x, next_y

        scan_obstacles(current_x, current_y)

        send_mqtt("robots/position_updates", "position_update", {
            "x": current_x, "y": current_y, "direction": direction
        })

        for led in leds.values(): led.set(0)
        time.sleep(0.2)

    send_mqtt("robots/position_updates", "position_update", {
        "x": current_x, "y": current_y, "direction": "none"
    })

def on_connect(client, userdata, flags, rc):
    print("Connected to MQTT")
    client.subscribe("server/tasks")
    client.subscribe("server/broadcast")

def on_message(client, userdata, msg):

    global current_task, stop_requested
    try:
        raw = msg.payload.decode()
        print(f"Received on topic '{msg.topic}': {raw}")
        payload = json.loads(raw)

        msg_type = payload.get("type")

        if msg_type == "task_assignment":
            task_data = payload.get("data", {})
            if task_data.get("robot_id") == robot_name:
                x = task_data.get("target_x")
                y = task_data.get("target_y")
                message_id = payload.get("id") or payload.get("message_id") or f"task_assignment-{random.randint(1000,9999)}"

                if x is not None and y is not None:
                    current_task = (x, y)
                    stop_requested = False
                    ack = {
                        "sender": robot_name,
                        "type": "acknowledgment",
                        "version": PROTOCOL_VERSION,
                        "timestamp": int(time.time()),
                        "data": {"received_message_id": message_id}
                    }
                    mqtt_client.publish("robots/acknowledgments", json.dumps(ack))
                    print(f"MQTT Sent to robots/acknowledgments: {ack}")

        elif msg_type == "stop_all":
            stop_requested = True
            print("Stop command received.")

    except Exception as e:
        send_mqtt("robots/errors", "error", {
            "error_code": 400,
            "error_message": f"Failed to parse task message: {str(e)}"
        })
#Sketchy maar tweede port voor 1883
tcp_mqtt_client = mqtt.Client()
tcp_mqtt_client.on_message = on_message


def on_tcp_connect(client, userdata, flags, rc):
    print("Connected to TCP MQTT on port 1883")
    client.subscribe("server/broadcast")

tcp_mqtt_client.on_connect = on_tcp_connect
tcp_mqtt_client.connect(address, 1883, 60)
threading.Thread(target=tcp_mqtt_client.loop_forever, daemon=True).start()

def start_mqtt_listener():
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message
    mqtt_client.connect(address, 9001, 60)
    threading.Thread(target=mqtt_client.loop_forever, daemon=True).start()


translationfield.setSFVec3f([0.0, 0.0, 0.05])
robot.step(timestep)
start_mqtt_listener()

send_mqtt("robots/position_updates", "position_update", {
    "x": 0,
    "y": 0,
    "direction": "none"
})

while robot.step(timestep) != -1:
    if current_task:
        x, y = current_task
        move_stepwise_to(x, y)
        current_task = None
