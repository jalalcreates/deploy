let io = undefined;

export const setSocketIOInstance = (ioInstance) => {
  io = ioInstance;
};

export const getSocketIOInstance = () => {
  if (!io) {
    throw new Error(
      "Socket.IO instance is not set. Please initialize it first."
    );
  }
  return io;
};
