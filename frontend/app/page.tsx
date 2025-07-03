"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, Users, Eye } from "lucide-react"
import { useRouter } from "next/navigation"
import { getWebSocket } from "@/lib/websocket"

export default function HomePage() {
  const [playerName, setPlayerName] = useState("")
  const [gameId, setGameId] = useState("")
  const router = useRouter()
  const webSocket = getWebSocket(); // Get the WebSocket instance

  // --- Start of Integrated Color Capture States and Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [rgbValues, setRgbValues] = useState<string>('---');
  const [hexValue, setHexValue] = useState<string>('---');
  const [colorSwatchColor, setColorSwatchColor] = useState<string>('transparent');
  const [currentStatusMessage, setCurrentStatusMessage] = useState<string>(''); // Initial message for webcam
  const [statusMessageType, setStatusMessageType] = useState<'info' | 'success' | 'error'>('info');
  const [hasCapturedColor, setHasCapturedColor] = useState(false); // State to track if color has been captured by THIS player
  const [hasCaptured, setHasCaptured] = useState(false);

  const updateStatusMessage = useCallback((msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setCurrentStatusMessage(msg);
    setStatusMessageType(type);
  }, []);

  const rgbToHex = useCallback((r: number, g: number, b: number): string => {
    const toHex = (c: number): string => {
      const hex = Math.round(c).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }, []);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!video || !canvas || !ctx || !video.srcObject) {
      updateStatusMessage('Webcam not active. Please allow camera access.', 'error');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const centerX = Math.floor(canvas.width / 2);
    const centerY = Math.floor(canvas.height / 2);
    const size = 10;

    const imageData = ctx.getImageData(centerX - size / 2, centerY - size / 2, size, size);
    const data = imageData.data;

    let r = 0, g = 0, b = 0;
    const pixelCount = size * size;

    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }

    r = Math.round(r / pixelCount);
    g = Math.round(g / pixelCount);
    b = Math.round(b / pixelCount);

    const hexColor = rgbToHex(r, g, b);

    setRgbValues(`(${r}, ${g}, ${b})`);
    setHexValue(hexColor);
    setColorSwatchColor(hexColor);
    setHasCapturedColor(true); // Mark that color has been captured
    setHasCaptured(true);
    updateStatusMessage('Color captured! You can now create or join a game.', 'success');
  }, [updateStatusMessage, rgbToHex]);
  // --- End of Integrated Color Capture Functions ---


  const handleReset = useCallback(() => {
  // Reset all color capture states
  setHasCapturedColor(false);
  setHasCaptured(false);
  setRgbValues('---');
  setHexValue('---');
  setColorSwatchColor('transparent');
  
  // Reset status message
  updateStatusMessage('Ready to scan again. Position your shirt in the center and click \'Take Photo\'.', 'info');

  // Stop current video stream
  if (videoRef.current?.srcObject) {
    const stream = videoRef.current.srcObject as MediaStream;
    const tracks = stream.getTracks();
    tracks.forEach((track) => track.stop());
    videoRef.current.srcObject = null;
  }

    // Restart webcam after a brief delay to ensure cleanup is complete
    setTimeout(async () => {
      if (videoRef.current && playerName.trim()) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoRef.current.srcObject = stream;
          updateStatusMessage('Webcam restarted. Position your shirt in the center and click \'Take Photo\'.', 'info');
        } catch (err) {
          console.error('Could not restart webcam:', err);
          updateStatusMessage('Could not restart webcam. Please refresh the page.', 'error');
        }
      }
    }, 100);
  }, [updateStatusMessage, playerName]);


  // Effect to start and clean up the webcam stream
  useEffect(() => {
    const startWebcam = async () => {
      if (videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoRef.current.srcObject = stream;
          updateStatusMessage('Webcam started. Position your shirt in the center and click \'Take Photo\'.', 'info');
        } catch (err) {
          console.error('Could not access webcam:', err);
          updateStatusMessage('Could not access webcam. Please ensure it\'s connected and permissions are granted.', 'error');
        }
      }
    };

    // Only start webcam if player name is entered and color hasn't been captured yet
    if (playerName.trim() && !hasCapturedColor) {
      startWebcam();
    } else if (!playerName.trim()) {
      updateStatusMessage('Enter your name to enable webcam and capture your shirt color.', 'info');
    }


    // Cleanup function: stop the webcam stream when the component unmounts or player name is cleared
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [playerName, hasCapturedColor, updateStatusMessage]); // Dependencies: playerName, hasCapturedColor


  const createGame = async () => {
    if (!playerName.trim() || !hasCapturedColor || hexValue === '---') {
      updateStatusMessage("Please enter your name and capture your shirt color first.", 'info');
      return; // Ensure color is captured
    }

    try {
      console.log("Attempting to emit 'create' with payload:", { playerName, shirtColor: hexValue });
      void webSocket.emit("create", { playerName: playerName, shirtColor: hexValue }); // Explicitly void the emit call

      const roomID = await new Promise<string>((resolve) => {
          webSocket.once("sendRoom", (room:string) => {
            console.log("Received room from server:", room);
            resolve(room);
          });
      });

      console.log("Navigating to lobby with roomID:", roomID);
      router.push(`/lobby/${roomID}?name=${encodeURIComponent(playerName)}&host=true`)
    } catch (error: any) {
      console.error("Error creating game:", error);
      updateStatusMessage(`Failed to create game: ${error.message || 'Unknown error'}`, 'error');
    }
  }


  const joinGame = () => {
    if (!playerName.trim() || !gameId.trim() || !hasCapturedColor || hexValue === '---') {
      updateStatusMessage("Please enter your name, game ID, and capture your shirt color first.", 'info');
      return; // Ensure color is captured
    }
  
    try {
      console.log("Attempting to emit 'join' with payload:", { gameID: gameId, playerName, shirtColor: hexValue });
      void webSocket.emit( // Explicitly void the emit call
        "join",
        { gameID: gameId, playerName, shirtColor: hexValue }, // Send shirtColor with join event
        (response: { success: boolean; message?: string }) => { // Explicitly type response
          if (!response.success) {
            updateStatusMessage(response.message || "Failed to join game.", 'error'); // Use updateStatusMessage
            console.log("Join failed:", response.message);
            return;
          }
          console.log("Successfully joined game, navigating to lobby.");
          router.push(`/lobby/${gameId}?name=${encodeURIComponent(playerName)}`);
        }
      );
    } catch (error: any) {
      console.error("Error joining game:", error);
      updateStatusMessage(`Failed to join game: ${error.message || 'Unknown error'}`, 'error');
    }
  };


  const spectateGame = () => {
    if (!gameId.trim()) {
      updateStatusMessage("Please enter a Game ID to spectate.", 'info');
      return;
    }

    try {
      void webSocket.emit("spectate",{"gameID":gameId},(response: { success: boolean; message?: string })=>{ // Explicitly void the emit call
          if (!response.success) {
            updateStatusMessage(response.message || "Failed to spectate game.", 'error'); // Use updateStatusMessage
            return;
        }
        console.log("Successfully spectating game, navigating to spectate page.");
        router.push(`/spectate/${gameId}`)
      });
    } catch (error: any) {
      console.error("Error spectating game:", error);
      updateStatusMessage(`Failed to spectate game: ${error.message || 'Unknown error'}`, 'error');
    }
  }

  // Determine message box styling based on statusMessageType for the color capture section
  const messageBoxClasses = `mt-6 p-3 rounded-lg text-sm ${
    currentStatusMessage ? '' : 'hidden'
  } ${
    statusMessageType === 'error' ? 'bg-red-100 text-red-800' :
    statusMessageType === 'success' ? 'bg-green-100 text-green-800' :
    'bg-blue-100 text-blue-800'
  }`;

  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-md mx-auto pt-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Zap className="w-12 h-12 text-yellow-400 mr-2" />
            <h1 className="text-4xl font-bold text-white">LaserTag</h1>
          </div>
          <p className="text-gray-300">Mobile AR Laser Tag Experience</p>
        </div>

        <Card className="mb-6 bg-black/20 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Player Setup</CardTitle>
            <CardDescription className="text-gray-300">Enter your name to start playing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => {
                setPlayerName(e.target.value);
                // Reset color capture status if name changes
                setHasCapturedColor(false);
                setHexValue('---');
                setRgbValues('---');
                setColorSwatchColor('transparent');
              }}
              className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
            />
          </CardContent>
        </Card>

        {/* Color Capture Section - Only visible if player name is entered */}
        {playerName.trim() && (
          <Card className="mb-6 bg-black/20 border-gray-700">
            <CardContent className="pt-6 text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-white">Scan Your Shirt Color</h3>
              <p className="text-gray-300 text-sm mb-4">
                Position your shirt in front of the camera and click "Take Photo".
              </p>
              {/* Video element to display webcam feed */}
              <video ref={videoRef} autoPlay playsInline className="border-2 border-gray-300 rounded-lg w-full mb-4"></video>

              {/* Button to capture the photo */}
              <Button
                onClick={handleCapture}
                disabled={!playerName.trim()} // Disable if no player name
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
              >
                Take Photo & Confirm Color
              </Button>

              {hasCaptured && (
                  <Button
                    onClick={handleReset}
                    className="mt-3 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-75"
                  >
                    Retake Photo
                  </Button>
                )}

              {/* Canvas (hidden) for image processing */}
              <canvas ref={canvasRef} className="hidden"></canvas>

              {/* Display area for RGB and Hex values */}
              <div className="mt-6 text-lg text-gray-700">
                <p className="mb-2 text-white">Captured RGB: <span id="rgbValues" className="font-bold text-gray-200">{rgbValues}</span></p>
                <p className="mb-2 text-white">Captured Hex: <span id="hexValue" className="font-bold text-gray-200">{hexValue}</span></p>
                <div
                  id="colorSwatch"
                  className="w-16 h-16 border-2 border-gray-400 rounded-full mx-auto shadow-inner"
                  style={{ backgroundColor: colorSwatchColor }}
                ></div>
              </div>

              {/* Message display area for color capture */}
              <div id="messageBox" className={messageBoxClasses} role="alert">
                {currentStatusMessage}
              </div>
            </CardContent>
          </Card>
        )}


        <div className="space-y-4">
          <Button
            onClick={createGame}
            disabled={!playerName.trim() || !hasCapturedColor} // Disabled until name and color are set
            className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            <Users className="w-5 h-5 mr-2" />
            Create New Game
          </Button>

          <Card className="bg-black/20 border-gray-700">
            <CardContent className="pt-6 space-y-4">
              <Input
                placeholder="Enter Game ID"
                value={gameId}
                onChange={(e) => setGameId(e.target.value.toUpperCase())}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={joinGame}
                  disabled={!playerName.trim() || !gameId.trim() || !hasCapturedColor} // Disabled until name, game ID, and color are set
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Join Game
                </Button>
                <Button
                  onClick={spectateGame}
                  disabled={!gameId.trim()}
                  variant="outline"
                  className="border-gray-600 text-white hover:bg-gray-800 bg-transparent"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Spectate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Use your camera to scan colored targets</p>
        </div>
      </div>
    </div>
  )
}
