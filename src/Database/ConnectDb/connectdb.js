// import "server-only";
import * as mongoose from "mongoose";
// import { GridFSBucket } from "mongodb";

let connected = false;
// let gfs;
const URI = process.env.MONGO_DB_URI;

export async function connectDb() {
  if (!mongoose) {
    (await import("mongoose")).default;
  }
  if (connected) {
    console.log("Database already connected...");
    return;
  }
  try {
    const db = await mongoose.connect(URI);
    connected = db.connections[0].states.connected;
    // gfs = new GridFSBucket(db.connections[0].db, {
    //   bucketName: "audioFiles",
    // });
    console.log("Database connected...");
  } catch (e) {
    console.log("Error connecting to database: ", e);
  }
}

// export { gfs };
