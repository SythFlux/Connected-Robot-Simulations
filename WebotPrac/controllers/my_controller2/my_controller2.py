from controller import Supervisor

def main():
    robot = Supervisor()
    supervisorNode = robot.getSelf()
    
    name_field = supervisorNode.getField("name")
  
       
    
    
    # Retrieve the "target" field (SFVec2f) from the PROTO
    target_field = supervisorNode.getField("target")
    if target_field is None:
        print("ERROR: 'target' field not found!")
        return
    target_vec = target_field.getSFVec2f()
    
    # Convert target values to integer grid coordinates
    tarX = int(target_vec[0])
    tarY = int(target_vec[1])
    print(name_field.getSFString(), "target is:", tarX, tarY)
    
    timeStep = int(robot.getBasicTimeStep())
    duration = (1000 // timeStep) * timeStep
    
    while robot.step(duration) != -1:
        # Get the current position in meters [x, y, z]
        pos = supervisorNode.getPosition()
        
        # Convert position to grid coordinates (each cell is 0.1 m)
        posX = round(pos[0] * 10)
        posY = round(pos[1] * 10)
        
        # Move one step toward the target
        if posX < tarX:
            posX += 1
        elif posX > tarX:
            posX -= 1

        if posY < tarY:
            posY += 1
        elif posY > tarY:
            posY -= 1
        
        trans = supervisorNode.getField("translation")
        # Convert grid coordinates back to world coordinates (meters)
        new_position = [posX * 0.1, posY * 0.1, 0.05]
        trans.setSFVec3f(new_position)
        
      
        
        # Check if the target has been reached
        if posX == tarX and posY == tarY:
            print(name_field.getSFString(), "Reached target at:", new_position)
            break

if __name__ == "__main__":
    main()
