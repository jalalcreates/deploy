// components/AudioPlayer.js
"use client";
import { useState } from "react";
import axios from "axios"; // Import Axios

const AudioPlayer = (audioData) => {
  const [audioUrl, setAudioUrl] = useState(null);

  const fetchAudio = async () => {
    try {
      // Call the API endpoint using Axios
      const response = await axios.post("/api/get-audio", audioData);

      const { result, contentType } = response.data;

      if (result) {
        // Create a data URL in the format: data:[contentType];base64,[data]
        const dataUrl = `data:${contentType};base64,${result}`;
        setAudioUrl(dataUrl);
      }
    } catch (error) {
      console.error("Error fetching audio:", error);
    }
  };

  return (
    <div>
      <button onClick={fetchAudio}>Play Audio</button>
      {audioUrl && <audio controls src={audioUrl}></audio>}
    </div>
  );
};

export default AudioPlayer;
