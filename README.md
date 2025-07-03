# BBD Vac Week 2025
The task was to create a game of laser tag that is the following:
- Uses the phone as the gun
- Uses computer vision to detect other players
- Multiplayer

## Tech stack
- Frontend:next.js
- Backend:node.js+express, with the use of socket.io
- Deployment: Vercel for frontend, and Render for backend

## Computer vision
The choosen computer vision model is YOLO, specifically the model used in this [repo](https://github.com/Hyuto/yolov5-tfjs). The model was tuned to use the human detection portion, and using a minimum confidence of 50%

## Solution
This app solves the problem as follows:
- Each user scans the colour of their tshirt.A user snap a photo of their shirt, and then the center porition is taken as their colour.
- Once the game is being played, if a user taps their string, a copy of that video feed is copied onto a temporary canvas. That temporary canvas is then run through YOLO, and if it detects a human, then the bounding box is sampled for colours.
- A player is tagged by the algorithm checking the colour in the bounding box, to the all the colours in the lobby. The closest colour gets tagged
- A player gets a powerup every 30 seconds, and a new gun(randomized) every 60 seconds.
- Sockets are used to create lobbies and handle all the multiplier.

## Potential improvements
Due to YOLO detecting any human, it can result in non-players being considered players. Potentially some feature engineering is needed to extract more features. YOLO could be used alongside some other models to extract more distinguished features about the scanned person.

## Running the code
Run:
```
git pull https://github.com/RynhardtGitHub/lasertag.git
```
Open 2 terminals and cd into the lasertag folder:
```
cd lasertag
```
To run the backend,first cd into the backend folder and run *npm install* then:
```
npm run dev
```
This will open up on localhost:3001. You might need to find websocket.ts, which is found in frontend/lib. You need to comment the code setting the this.socket to the onrender url, and uncomment the localhost one.

To run the backend,first cd into the frontend folder and run *npm install* then:
```
npm run dev
```
This will open an instance on localhost:3000.

Open localhost:3000, and the app can be played now.
