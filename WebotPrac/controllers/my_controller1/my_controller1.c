#include <stdio.h>
#include <math.h>
#include <webots/robot.h>
#include <webots/supervisor.h>

#define TARGET_X 0.1
#define TARGET_Y 0.1

int main(int argc, char **argv) {
  // Initialize the Webots robot (Supervisor) API.
  wb_robot_init();
  
  // Get a reference to the robot's own node.
  WbNodeRef robot_node = wb_supervisor_node_get_self();
  
  // Get the 'translation' field of the robot to update its position.
  WbFieldRef translation_field = wb_supervisor_node_get_field(robot_node, "translation");
  
  // Get the basic time step of the simulation.
  int time_step = wb_robot_get_basic_time_step();
  // Calculate a duration that approximates one second (in milliseconds).
  int duration = (1000 / time_step) * time_step;
  
  while (wb_robot_step(duration) != -1) {
    // Retrieve the current position of the robot.
    const double *position = wb_supervisor_node_get_position(robot_node);
    
    // Convert the position to grid coordinates (each grid cell is 0.1 m).
    int posX = (int)round(position[0] * 10);
    int posY = (int)round(position[1] * 10);
    
    printf("Current grid position: %d, %d\n", posX, posY);
    
    // Check if the target has been reached.
    if (posX == TARGET_X && posY == TARGET_Y) {
      printf("Target reached at (%d, %d)\n", TARGET_X, TARGET_Y);
      break;
    }
    
    // Determine the next grid position: take one step toward the target.
    int newPosX = posX;
    int newPosY = posY;
    
    if (posX < TARGET_X)
      newPosX++;
    else if (posX > TARGET_X)
      newPosX--;
    
    if (posY < TARGET_Y)
      newPosY++;
    else if (posY > TARGET_Y)
      newPosY--;
    
    // Convert the new grid coordinates back to world coordinates (in meters).
    double newPosition[3] = { newPosX * 0.1, newPosY * 0.1, 0.0 };
    
    // Update the robot's position.
    wb_supervisor_field_set_sf_vec3f(translation_field, newPosition);
    
    printf("Moving to new position: (%.2f, %.2f, %.2f)\n", newPosition[0], newPosition[1], newPosition[2]);
  }
  
  wb_robot_cleanup();
  return 0;
}
