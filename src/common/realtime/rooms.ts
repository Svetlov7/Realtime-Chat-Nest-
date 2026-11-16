/** Every socket of a user joins this room on connect, so emitting to it reaches all their devices. */
export const userRoom = (userId: string): string => `user:${userId}`;

/** Sockets of all members of a conversation; kept in sync on connect and on membership changes. */
export const conversationRoom = (conversationId: string): string =>
  `conversation:${conversationId}`;
