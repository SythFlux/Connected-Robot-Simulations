document.addEventListener('DOMContentLoaded', function () {
    // Protocol version
    const PROTOCOL_VERSION = "1.3";
    // Function to add an obstacle to the array
    function addObstacle(obstacle) {
        obstacles.push(obstacle);
    }
    const obstacles = []; // Array to store obstacle information
    // Robot states
    const robots = {
        'robot_1': createRobotState('Robot 1'),
        'robot_2': createRobotState('Robot 2'),
        'robot_3': createRobotState('Robot 3'),
        'robot_4': createRobotState('Robot 4')
    };

    // UI Elements
    const dashboard = document.querySelector('.dashboard');
    const robotContainer = document.getElementById('robot-container');
    const messageLog = document.createElement('div');
    messageLog.className = 'log';
    messageLog.innerHTML = '<h3>Message Log</h3><div id="message-log-content"></div>';
    dashboard.appendChild(messageLog);

    // Connection status UI
    const mqttStatus = document.getElementById('mqtt-status');
    const mqttStatusIndicator = document.getElementById('mqtt-status-indicator');

    function createRobotState(name) {
        return {
            name: name,
            online: false,
            x: 0,
            y: 0,
            direction: 'null',
            lastUpdate: null,
            element: null,
            currentTask: null
        };
    }

    function updateRobotUI(robotId) {
        const robot = robots[robotId];
        if (!robot) {
            console.error(`Robot ${robotId} not found`);
            return;
        }

        if (!robot.element) {
            robot.element = document.createElement('div');
            robot.element.className = 'robot-card';
            robot.element.id = `robot-${robotId}`;
            robotContainer.appendChild(robot.element);
        }

        robot.element.innerHTML = `
          <h2>${robot.name}</h2>
          <div class="status-line">
              <span class="status-label">Status:</span>
              <span class="status-value">${robot.online ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <div class="status-line">
              <span class="status-label">Position:</span>
              <span class="status-value">(${robot.x}, ${robot.y})</span>
          </div>
          <div class="status-line">
              <span class="status-label">Direction:</span>
              <span class="status-value">${robot.direction}</span>
              <div class="direction">${getDirectionArrow(robot.direction)}</div>
          </div>
          <div class="status-line">
              <span class="status-label">Current Task:</span>
              <span class="status-value">${robot.currentTask || 'None'}</span>
          </div>
          <div class="last-update">Last update: ${robot.lastUpdate || 'Never'}</div>
      `;

        robot.element.classList.toggle('online', robot.online);
        robot.element.classList.toggle('offline', !robot.online);

        updateConnectedRobotsCount();
    }

    function getDirectionArrow(dir) {
        const arrows = {
            north: '↑',
            east: '→',
            south: '↓',
            west: '←',
        };
        return arrows[dir.toLowerCase()] || dir;
    }

    function addLog(message) {
        const log = document.getElementById('message-log-content');
        const entry = document.createElement('div');
        entry.className = 'log-entry';

        // Handle multi-line messages
        const lines = message.split('\n');
        lines.forEach((line, index) => {
            const lineElement = document.createElement('div');
            if (index === 0) {
                lineElement.textContent = `${new Date().toLocaleTimeString()}: ${line}`;
            } else {
                lineElement.textContent = `    ${line}`;
                lineElement.style.marginLeft = '20px';
            }
            entry.appendChild(lineElement);
        });

        log.insertBefore(entry, log.firstChild);
        if (log.children.length > 100) {
            log.removeChild(log.lastChild);
        }
    }

    function addTask(task) {
        const taskList = document.getElementById('task-list');
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item';
        taskElement.innerHTML = `
          <strong>${task.robot_id}</strong>: ${task.task} at (${task.target_x}, ${task.target_y})
          <span class="task-time">${new Date(task.timestamp * 1000).toLocaleTimeString()}</span>
      `;
        taskList.insertBefore(taskElement, taskList.firstChild);
        if (taskList.children.length > 20) {
            taskList.removeChild(taskList.lastChild);
        }
    }

    function addObstacle(obstacle) {
        const obstacleList = document.getElementById('obstacle-list');
        const obstacleElement = document.createElement('div');
        obstacleElement.className = 'obstacle-item';
        obstacleElement.innerHTML = `
          <strong>${obstacle.sender}</strong>: ${obstacle.obstacle_type} at (${obstacle.x}, ${obstacle.y})
          <span class="obstacle-time">${new Date(obstacle.timestamp * 1000).toLocaleTimeString()}</span>
      `;
        obstacleList.insertBefore(obstacleElement, obstacleList.firstChild);
        if (obstacleList.children.length > 20) {
            obstacleList.removeChild(obstacleList.lastChild);
        }
    }
    function addAcknowledgment(ack) {
        const ackList = document.getElementById('ack-list');
        const ackElement = document.createElement('div');
        ackElement.className = 'ack-item';
        ackElement.innerHTML = `
      <strong>${ack.sender}</strong>: Acknowledged message ID <code>${ack.messageId}</code>
      <span class="ack-time">${new Date(ack.timestamp * 1000).toLocaleTimeString()}</span>
    `;
        ackList.insertBefore(ackElement, ackList.firstChild);
        if (ackList.children.length > 20) {
            ackList.removeChild(ackList.lastChild);
        }
    }

    function addError(error) {
        const errorList = document.getElementById('error-list');
        const errorElement = document.createElement('div');
        errorElement.className = 'error-item';
        errorElement.innerHTML = `
      <strong>${error.sender}</strong>: ${error.message}
      <span class="error-code">Code: ${error.code}</span>
      <span class="error-time">${new Date(error.timestamp * 1000).toLocaleTimeString()}</span>
    `;
        errorList.insertBefore(errorElement, errorList.firstChild);
        if (errorList.children.length > 20) {
            errorList.removeChild(errorList.lastChild);
        }
    }


    function updateConnectedRobotsCount() {
        const connected = Object.values(robots).filter(r => r.online).length;
        document.getElementById('connected-robots').textContent = connected;
    }

    function updateConnectionStatus(connected) {
        mqttStatus.textContent = connected ? 'Connected to MQTT' : 'Disconnected from MQTT';
        mqttStatusIndicator.className = connected ? 'status-indicator connected' : 'status-indicator disconnected';
    }

    // Initialize all robot UIs
    Object.keys(robots).forEach(robotId => {
        updateRobotUI(robotId);
    });

    // Init MQTT
    const client = new Paho.Client(
        window.location.hostname,
        Number(443),
        '/mqtt',
        `dashboard-${Math.random().toString(16).substr(2, 8)}`
    );

    client.connect({
        userName: 'user',
        password: 'user123',
        useSSL: true,
        mqttVersion: 4,
        onSuccess: () => {
            updateConnectionStatus(true);
            addLog('Connected to MQTT broker'); 

            // Subscribe to topics
            client.subscribe('robots/position_updates');
            client.subscribe('robots/obstacles');
            client.subscribe('server/tasks');
            client.subscribe('robots/acknowledgments');
            client.subscribe('robots/errors');
            client.subscribe('server/broadcast');
            console.log('Subscribed to all topics');
        },
        onFailure: (err) => {
            updateConnectionStatus(false);
            addLog(`Connection failed: ${err.errorMessage}`);
            console.error('Connection failed:', err);
        }
    });

    client.onMessageArrived = (message) => {
        const topic = message.destinationName;
        const payload = message.payloadString;

        try {
            const msg = JSON.parse(payload);
            console.log('Received message:', msg);

            // Validate basic message structure
            if (!msg.sender || !msg.type || !msg.timestamp) {
                throw new Error('Invalid message structure - missing required fields');
            }

            // Check protocol version
            if (msg.version && msg.version !== PROTOCOL_VERSION) {
                addLog(`Version mismatch from ${msg.sender}: Expected ${PROTOCOL_VERSION}, got ${msg.version}`);
                return;
            }

            // Handle different message types
            switch (msg.type.toLowerCase()) {
                case 'position_update':
                    if (!msg.data || msg.data.x === undefined || msg.data.y === undefined || !msg.data.direction) {
                        throw new Error('Invalid position_update structure');
                    }

                    if (robots[msg.sender]) {
                        robots[msg.sender].online = true;
                        robots[msg.sender].x = msg.data.x;
                        robots[msg.sender].y = msg.data.y;
                        robots[msg.sender].direction = msg.data.direction;
                        robots[msg.sender].lastUpdate = new Date(msg.timestamp * 1000).toLocaleTimeString();
                        updateRobotUI(msg.sender);
                        addLog(`${msg.sender} position: (${msg.data.x}, ${msg.data.y}) facing ${msg.data.direction}`);
                    } else {
                        addLog(`Received update for unknown robot: ${msg.sender}`);
                    }
                    break;
                    case 'obstacle_detected':
                        if (!msg.data || msg.data.x === undefined || msg.data.y === undefined || !msg.data.obstacle_type) {
                          addLog('Invalid obstacle_detected structure');
                          return;
                        }
                  
                        // 1) Show it in the UI list
                        addObstacle({
                          sender: msg.sender,
                          x: msg.data.x,
                          y: msg.data.y,
                          obstacle_type: msg.data.obstacle_type,
                          timestamp: msg.timestamp
                        });
                  
                        // 2) Also store it for canvas drawing
                        obstacles.push({
                          x: msg.data.x,
                          y: msg.data.y,
                          obstacle_type: msg.data.obstacle_type,
                          timestamp: msg.timestamp
                        });
                  
                        addLog(`${msg.sender} detected ${msg.data.obstacle_type} at (${msg.data.x}, ${msg.data.y})`);
                        break;

                case 'task_assignment':
                    if (!msg.data || !msg.data.robot_id || !msg.data.task ||
                        msg.data.target_x === undefined || msg.data.target_y === undefined) {
                        throw new Error('Invalid task_assignment structure');
                    }

                    if (robots[msg.data.robot_id]) {
                        robots[msg.data.robot_id].currentTask = msg.data.task;
                        updateRobotUI(msg.data.robot_id);
                    }
                    addTask({
                        robot_id: msg.data.robot_id,
                        task: msg.data.task,
                        target_x: msg.data.target_x,
                        target_y: msg.data.target_y,
                        timestamp: msg.timestamp
                    });
                    addLog(`Task assigned: ${msg.data.robot_id} to ${msg.data.task} at (${msg.data.target_x}, ${msg.data.target_y})`);
                    break;

                case 'acknowledgment':
                    if (!msg.data || !msg.data.received_message_id) {
                        throw new Error('Invalid acknowledgment structure');
                    }
                    addAcknowledgment({
                        sender: msg.sender,
                        messageId: msg.data.received_message_id,
                        timestamp: msg.timestamp
                    });
                    addLog(`${msg.sender} acknowledged: ${msg.data.received_message_id}`);
                    break;

                case 'error':
                    if (!msg.data || !msg.data.error_code || !msg.data.error_message) {
                        throw new Error('Invalid error structure');
                    }
                    addError({
                        sender: msg.sender,
                        message: msg.data.error_message,
                        code: msg.data.error_code,
                        timestamp: msg.timestamp
                    });
                    addLog(`ERROR from ${msg.sender}: ${msg.data.error_message} (code ${msg.data.error_code})`);
                    break;
                    case 'stop_all':
                        if (!msg.data) {
                            throw new Error('Invalid stop structure');
                        }
                        addLog(`Stop from ${msg.sender} stopped all processes`);
                        break;
                default:
                    addLog(`Unknown message type from ${msg.sender}: ${msg.type}`);
            }
        } catch (e) {
            addLog(`Error processing message: ${e.message}`);
            console.error('Error processing message:', e, 'Raw message:', message);
        }
    };

    client.onConnectionLost = (response) => {
        updateConnectionStatus(false);
        if (response.errorCode !== 0) {
            addLog(`Connection lost: ${response.errorMessage}`);
            console.error('Connection lost:', response);
        }
    };

    // Periodically mark robots as offline if no updates received
    setInterval(() => {
        const now = Date.now();
        Object.keys(robots).forEach(robotId => {
            const robot = robots[robotId];
            if (robot.lastUpdate && (now - new Date(robot.lastUpdate).getTime() > 30000)) {
                robot.online = false;
                updateRobotUI(robotId);
            }
        });
    }, 10000);

    // Add test buttons for development
    const testButtons = document.createElement('div');
    testButtons.className = 'test-buttons';
    testButtons.innerHTML = `
      <h3>Test Messages</h3>
      <button onclick="sendTestMessage('position')">Position Update</button>
      <button onclick="sendTestMessage('obstacle')">Obstacle Detected</button>
      <button onclick="sendTestMessage('error')">Error Message</button>
     <button onclick="sendTestMessage('ack')">Acknowledgment</button>
  `;
    dashboard.appendChild(testButtons);
    // Get the existing canvas element from the HTML
    const mapCanvas = document.getElementById('robot-canvas');

    function drawMap() {
        const ctx = mapCanvas.getContext('2d');
        ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height); // Clear the canvas
    
        const cellSize = 80;  // Size of each cell
        const cols = 10;      // Number of columns (0 to 9)
        const rows = 10;      // Number of rows (0 to -9)
    
        // Draw grid
        ctx.strokeStyle = '#ccc';
        for (let x = 0; x <= cols; x++) {
            ctx.beginPath();
            ctx.moveTo(x * cellSize, 0);
            ctx.lineTo(x * cellSize, mapCanvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= rows; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * cellSize);
            ctx.lineTo(mapCanvas.width, y * cellSize);
            ctx.stroke();
        }
    
        // Adjust the Y-axis: Flip so that top is 0, and bottom is -9
        const convertY = y => (9 - Math.abs(y)); // Convert the Y-axis to fit canvas (top = 0, bottom = -9)
    
        // Helper function to check if a coordinate is within the valid boundary
        const isWithinBounds = (x, y) => x >= 0 && x <= 9 && y >= -9 && y <= 0;
    
        // Draw robots
        function getColorForRobotIndex(index) {
            const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FF8C00', '#8A2BE2', '#FF6347', '#7FFF00'];
            return colors[index % colors.length];
        }
    
        Object.values(robots).forEach((robot, index) => {
            if (!robot.online) return;
    
            // Only display if robot is within bounds
            if (!isWithinBounds(robot.x, robot.y)) return;
    
            const robotColor = getColorForRobotIndex(index);
            const drawX = robot.x * cellSize;            // X-axis from 0 to 9
            const drawY = (Math.abs(robot.y) * cellSize); // Convert Y-axis (flip to canvas system)
    
            ctx.fillStyle = robotColor;
            ctx.fillRect(drawX + 4, drawY + 4, cellSize - 8, cellSize - 8);  // Draw robot
    
            ctx.fillStyle = 'white';
            ctx.font = '10px sans-serif';
            ctx.fillText(robot.name.replace('Robot ', 'R'), drawX + 6, drawY + 14);
        });
    
        // Draw obstacles
        obstacles.forEach(ob => {
            // Only display if obstacle is within bounds
            if (!isWithinBounds(ob.x, ob.y)) return;
    
            const drawX = ob.x * cellSize;              // X-axis from 0 to 9
            const drawY = (Math.abs(ob.y) * cellSize);   // Convert Y-axis (flip to canvas system)
    
            ctx.fillStyle = 'black';
            ctx.fillRect(drawX + 4, drawY + 4, cellSize - 8, cellSize - 8);  // Draw obstacle
    
            ctx.fillStyle = 'white';
            ctx.font = '10px sans-serif';
            ctx.fillText(ob.obstacle_type, drawX + 4, drawY + 14);  // Label the obstacle
        });
    }
    
    // Redraw every second
    setInterval(drawMap, 1000);  // Redraw every 1000ms (1 second)
    
    
    

    window.sendTestMessage = function (type) {
        let msg;
        const timestamp = Math.floor(Date.now() / 1000);
        const robotId = `robot_${Math.floor(Math.random() * 4) + 1}`;

        switch (type) {
            case 'position':
                msg = {
                    sender: robotId,
                    type: "position_update",
                    timestamp: timestamp,
                    version: "1.3",
                    data: {
                        // Update the test position to match the 0-9 and 0-(-9) mapping
                        x: Math.floor(Math.random() * 10),  // X is 0 to 9
                        y: Math.floor(Math.random() * 10) - 9,  // Y is 0 to -9 (e.g., -9 to 0)
                        direction: ["north", "south", "east", "west"][Math.floor(Math.random() * 4)]
                    }
                };
                break;
            case 'obstacle':
                msg = {
                    sender: robotId,
                    type: "obstacle_detected",
                    timestamp: timestamp,
                    version: "1.3",
                    data: {
                        // Update the test obstacle to match the 0-9 and 0-(-9) mapping
                        x: Math.floor(Math.random() * 10),  // X is 0 to 9
                        y: Math.floor(Math.random() * 10) - 9,  // Y is 0 to -9
                        obstacle_type: ["wall", "object", "person", "unknown"][Math.floor(Math.random() * 4)]
                    }
                };
                break;

            case 'error':
                msg = {
                    sender: robotId,
                    type: "error",
                    timestamp,
                    version: "1.3",
                    data: {
                        error_code: "E" + Math.floor(Math.random() * 200),
                        error_message: "Test error message\nWith multiple lines\nFor testing purposes"
                    }
                };
                break;

            case 'ack':
                const messageId = `msg_${Math.random().toString(16).substr(2, 8)}`;
                msg = {
                    sender: robotId,
                    type: "acknowledgment",
                    timestamp,
                    version: "1.3",
                    data: {
                        received_message_id: messageId
                    }
                };
                break;

            default:
                console.warn("Unknown test message type:", type);
                return;
        }

        // map type to your MQTT topic
        const topicMap = {
            position: "robots/position_updates",
            obstacle: "robots/obstacles",
            error: "robots/errors",
            ack: "robots/acknowledgments"
        };

        client.onMessageArrived({
            destinationName: topicMap[type],
            payloadString: JSON.stringify(msg)
        });
    };

    function updateTime() {
        document.getElementById('current-time').textContent = new Date().toLocaleString();
    }
    setInterval(updateTime, 1000);
    updateTime();
    document.getElementById('task-assignment-form').addEventListener('submit', function (e) {
        e.preventDefault(); // Prevent form default submit action

        const robotId = document.getElementById('robot-select').value;
        const task = document.getElementById('task-name').value.trim();
        const targetX = parseInt(document.getElementById('target-x').value);
        const targetY = parseInt(document.getElementById('target-y').value);
        const timestamp = Math.floor(Date.now() / 1000);

        if (!task || isNaN(targetX) || isNaN(targetY)) {
            alert("Please fill out all fields.");
            return;
        }

        const message = new Paho.Message(JSON.stringify({
            sender: 'dashboard',
            type: 'task_assignment',
            version: '1.3',
            timestamp: timestamp,
            data: {
                robot_id: robotId,
                task: task,
                target_x: targetX,
                target_y: targetY
            }
        }));

        message.destinationName = 'server/tasks';
        client.send(message);

        addLog(`Sent task: ${robotId} to ${task} at (${targetX}, ${targetY})`);

        this.reset(); // Reset the form after submitting
    });

    // Add event listener to focus the next field on Enter press
    const formInputs = document.querySelectorAll('#task-assignment-form input, #task-assignment-form select');

    formInputs.forEach((input, index) => {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();  // Prevent the default form submission on Enter key

                // Move focus to the next input if it's filled (skip if empty)
                if (input.value.trim() !== '' || input.type === 'select-one') {
                    const nextInput = formInputs[index + 1];
                    if (nextInput) {
                        nextInput.focus();
                    }
                }
            }
        });
    });

    // Check if all fields are filled when pressing Enter on the last input, and simulate clicking the submit button
    document.getElementById('task-assignment-form').addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            const robotId = document.getElementById('robot-select').value;
            const task = document.getElementById('task-name').value.trim();
            const targetX = parseInt(document.getElementById('target-x').value);
            const targetY = parseInt(document.getElementById('target-y').value);

            if (robotId && task && !isNaN(targetX) && !isNaN(targetY)) {
                // Simulate clicking the submit button when all fields are filled
                document.querySelector('button[type="submit"]').click();
            }
        }
    });
    document.getElementById('stop-all-btn').addEventListener('click', () => {
        const message = {
            type: "stop_all",
            version: PROTOCOL_VERSION,
            timestamp: Math.floor(Date.now() / 1000),
            sender: "dashboard",
            data: {}
        };
    
        const topic = "server/broadcast";
        const payload = JSON.stringify(message);
    
        if (client && client.isConnected()) {
            client.publish(topic, payload);
            console.log(`Stop command sent to ${topic}:`, payload);
        } else {
            console.warn("MQTT client is not connected.");
        }
    });
    
});
