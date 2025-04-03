/*DEZE CODE IS VAN EEN ANDER IOT DIE IK GEMAAKT HAD IK HEB EEN BEETJE HIER EEN DAAR VERANDERD MAAR IK WEET NIET OF DIE GOED WERKT.
In feite hoeft er alleen van de simulatie regelmatig een payload te komen van de richting van de robot en van de esp of die aan of uit is en dan doet dit de rest!*/

document.addEventListener('DOMContentLoaded', function() {
    //robo states
    const robots = {
      'robot1': createRobotState('Robot 1'),
      'robot2': createRobotState('Robot 2'), 
      'robot3': createRobotState('Robot 3'),
      'robot4': createRobotState('Robot 4')
    };
    
    // Log for test topic
    const testTopicLog = document.createElement('div');
    testTopicLog.className = 'log';
    testTopicLog.innerHTML = '<h3>Test Topic Log</h3><div id="test-topic-messages"></div>';
    document.querySelector('.dashboard').appendChild(testTopicLog);
  
    function createRobotState(name) {
      return {
        name: name,
        online: false,
        direction: 'N',
        lastUpdate: null,
        element: null
      };
    }
    
    function updateRobotUI(robotId) {
      const robot = robots[robotId];
      if (!robot.element) {
        robot.element = document.createElement('div');
        robot.element.className = 'robot-card';
        robot.element.innerHTML = `
          <h2>${robot.name}</h2>
          <div class="status-line">
            <span class="status-label">Status:</span>
            <span class="status-value">${robot.online ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <div class="status-line">
            <span class="status-label">Direction:</span>
            <span class="status-value">${robot.direction}</span>
            <div class="direction">${getDirectionArrow(robot.direction)}</div>
          </div>
        `;
        document.getElementById('robot-container').appendChild(robot.element);
      } else {
        robot.element.querySelector('.status-value:nth-of-type(1)').textContent = 
          robot.online ? 'ONLINE' : 'OFFLINE';
        robot.element.querySelector('.status-value:nth-of-type(2)').textContent = 
          robot.direction;
        robot.element.querySelector('.direction').innerHTML = 
          getDirectionArrow(robot.direction);
      }
      robot.element.classList.toggle('online', robot.online);
    }
    
    function getDirectionArrow(dir) {
      const arrows = { N: '↑', NE: '↗', E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖' };
      return arrows[dir] || dir;
    }
    
    function addLog(message) {
      const log = document.getElementById('message-log');
      log.textContent = `${new Date().toLocaleTimeString()}: ${message}\n${log.textContent}`;
    }
    
    function addTestTopicMessage(message) {
      const log = document.getElementById('test-topic-messages');
      log.textContent = `${new Date().toLocaleTimeString()}: ${message}\n${log.textContent}`;
    }
  
    // Init MQTT
    const client = new Paho.Client(
      window.location.hostname,
      Number(443),
      '/mqtt',
      `dashboard-${Math.random().toString(16).substr(2, 8)}`
    );
    //init
    client.connect({
      userName: 'user',
      password: 'user123',
      useSSL: true,
      mqttVersion: 4,
      onSuccess: () => {
        addLog('Connected to MQTT broker');
        
        // Subscribe to topics
        Object.keys(robots).forEach(robotId => {
          client.subscribe(`robot/${robotId}/status`);
          client.subscribe(`robot/${robotId}/direction`);
          updateRobotUI(robotId);
        });
        
    
        client.subscribe('test/topic');
      },
      onFailure: (err) => {
        addLog(`Connection failed: ${err.errorMessage}`);
      }
    });
    
    client.onMessageArrived = (message) => {
      const topic = message.destinationName;
      const payload = message.payloadString;
      
      // Handle robot topics
      if (topic.startsWith('robot/')) {
        const topicParts = topic.split('/');
        const robotId = topicParts[1];
        const metric = topicParts[2];
        
        if (robots[robotId]) {
          if (metric === 'status') {
            robots[robotId].online = payload === 'online';
          } else if (metric === 'direction') {
            robots[robotId].direction = payload;
          }
          robots[robotId].lastUpdate = new Date().toLocaleTimeString();
          updateRobotUI(robotId);
        }
        addLog(`${topic}: ${payload}`);
      } 
      // test/topic handler
      else if (topic === 'test/topic') {
        addTestTopicMessage(payload);
        addLog(`Test topic: ${payload}`);
      }
    };
    
    client.onConnectionLost = (response) => {
      if (response.errorCode !== 0) {
        addLog(`Connection lost: ${response.errorMessage}`);
      }
    };
  });