# Connected-Robot-Simulations

Namen: Donny Vo, Long Vo, Wen Hao You, Alexander Ikpa
Datum: project 24/03/2025

# Project Description

Connected-Robot-Simulation is a project that uses software like WeBots to create
a digital twin to simulate movements in the software with physical reality.

In Webots a worldspace is set up where robots can move on a grid, with the use of websockets that sends protocols
to a centralized server, the user can choose specifik units and move them to a specified location on the grid.

The protocols that get sent also go through the ESP32 microcontroller that displays with LED lights what direction the
robot is currently moving.

# Central Server

The Centralized Server runs on docker containers, so everything
can be run with a simple ```docker compose up```, The system will implement
Mosquitto as communicationmethod.

# Dashboard

A dashboard is created to visualize the the simulation on a website, with the use of HTML5 we can 
create the same playing field as the one in WeBots and display the robots as the move on the grid. 

Furthermore the dashboard needs to contain a user-interface where the user can choose commands for 

The dashboard
contains general information where all the units reside and
