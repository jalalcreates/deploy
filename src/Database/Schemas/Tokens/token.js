import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema({
  refreshTokens: [String],
});

const RefreshToken =
  mongoose.models && mongoose.models.RefreshToken
    ? mongoose.models.RefreshToken
    : mongoose.model("RefreshToken", refreshTokenSchema);

export default RefreshToken;
