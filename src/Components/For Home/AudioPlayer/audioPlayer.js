"use client";
import { useState, useRef } from "react";
import axios from "axios";
import styles from "./audioPlayer.module.css";

export default function AudioPlayer({ audioData }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const fetchAudio = async () => {
    if (audioUrl) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post("/api/get-audio", audioData);

      const { result, contentType } = response.data;

      if (result) {
        // Create a data URL in the format: data:[contentType];base64,[data]
        const dataUrl = `data:${contentType};base64,${result}`;
        setAudioUrl(dataUrl);
      }
    } catch (error) {
      console.error("Error fetching audio:", error);
      setError("Failed to load audio");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayPause = async () => {
    if (!audioUrl) {
      await fetchAudio();
      return;
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleAudioPause = () => {
    setIsPlaying(false);
  };

  const handleAudioPlay = () => {
    setIsPlaying(true);
  };

  return (
    <div className={styles.audioPlayer}>
      <button
        className={styles.playPauseBtn}
        onClick={togglePlayPause}
        disabled={isLoading}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isLoading ? "⏳" : isPlaying ? "⏸️" : "▶️"}
      </button>

      <div className={styles.audioControls}>
        {isLoading && (
          <span className={styles.loadingText}>Loading audio...</span>
        )}
        {error && <span className={styles.errorText}>{error}</span>}
        {audioUrl && (
          <audio
            ref={audioRef}
            className={styles.audioElement}
            controls
            src={audioUrl}
            onEnded={handleAudioEnded}
            onPause={handleAudioPause}
            onPlay={handleAudioPlay}
          />
        )}
      </div>
    </div>
  );
}
