import { connectDb } from "@/Database/ConnectDb/connectdb";
import Audio from "@/Database/Schemas/Audios/audios";
import Orders from "@/Database/Schemas/Orders/orders";
import ServiceRequests from "@/Database/Schemas/ServiceRequests/serviceRequests";

export async function saveAudio(audioFile) {
  connectDb();
  try {
    if (!audioFile) return { result: null };
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const audio = await Audio.create({
      filename: "audio_recording.webm",
      contentType: "audio/webm",
      length: audioBuffer.length,
      uploadDate: new Date(),
      data: audioBuffer,
    });
    await audio.save();
    return { id: audio._id };
  } catch (error) {
    console.log(`Error in saveAudio(). Error : ${error}`);
  }
}

export async function getAudio(audioId) {
  await connectDb();
  try {
    const audio = await Audio.findById(audioId);
    if (!audio) return { result: null };

    return {
      result: audio.data.toString("base64"),
      contentType: audio.contentType || "audio/webm",
    };
  } catch (error) {
    console.error("Error in getAudio():", error);
    return { result: null };
  }
}

const ALLOWED_AUDIO_TYPES = [
  "audio/webm",
  "audio/wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/ogg",
];

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MIN_FILE_SIZE_BYTES = 1000; // 1KB minimum

export function isValidAudioFile(file) {
  if (!file || typeof file !== "object") {
    console.warn("No file object passed.");
    return false;
  }

  if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
    console.warn("Rejected file due to invalid type:", file.type);
    return false;
  }

  if (file.size < MIN_FILE_SIZE_BYTES) {
    console.warn(
      "Rejected file due to too small size (empty or corrupt):",
      file.size
    );
    return false;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    console.warn("Rejected file due to size limit:", file.size);
    return false;
  }

  return true;
}
