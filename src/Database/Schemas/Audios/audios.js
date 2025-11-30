import mongoose from "mongoose";

const audioSchema = new mongoose.Schema({
  filename: String,
  contentType: String,
  length: Number,
  uploadDate: Date,
  data: Buffer,
});
const Audio =
  mongoose.models && mongoose.models.Audio
    ? mongoose.models.Audio
    : mongoose.model("Audio", audioSchema);
export default Audio;
