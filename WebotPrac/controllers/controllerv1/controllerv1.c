from controller import Supervisor
import math

# Create the Supervisor instance (this also creates the robot)
robot = Supervisor()
# Get the robot's own node
supervisor_node = robot.getSelf()

# Retrieve the basic time step of the simulation
time_step = int(robot.getBasicTimeStep())
# Calculate a duration that approximates one second (in milliseconds)
duration = (1000 // time_step) * time_step

# Define target grid coordinates (example: (9, 9))
target_x = 9
target_y = 9

print("Starting Practicum 1 controller...")

while robot.step(duration) != -1:
    # Get the current position in meters [x, y, z]
    pos = supervisor_node.getPosition()
    # Convert to grid coordinates (each grid cell is 0.1 m)
    pos_x = round(pos[0] * 10)
    pos_y = round(pos[1] * 10)
    
    print("Current grid position:", pos_x, pos_y)
    
    # Check if the target has been reached
    if pos_x == target_x and pos_y == target_y:
        print("Target reached at ({}, {})".format(target_x, target_y))
        break

    # Determine the next grid position by taking one step toward the target
    new_pos_x = pos_x + (1 if pos_x < target_x else -1 if pos_x > target_x else 0)
    new_pos_y = pos_y + (1 if pos_y < target_y else -1 if pos_y > target_y else 0)

    # Convert grid coordinates back to meters (each grid unit is 0.1 m)
    new_position = [new_pos_x * 0.1, new_pos_y * 0.1, 0.0]

    # Get the translation field of the robot node and update its position
    trans_field = supervisor_node.getField("translation")
    trans_field.setSFVec3f(new_position)
    
    print("Moving to new position:", new_position)
    
robot.cleanup()
