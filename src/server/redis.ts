import { Devvit } from "@devvit/public-api";

const storeCapsuleData = async (
  context: Devvit.Context,
  capsuleId: string,
  data: string
) => {
  try {
    await context.redis.set(capsuleId, JSON.stringify(data), {});
    return true;
  } catch (error) {
    console.error("Error storing capsule data:", error);
    return false;
  }
};

const retrieveCapsuleData = async (
  context: { redis: { get: (arg0: any) => any } },
  capsuleId: any
) => {
  try {
    const capsuleData = await context.redis.get(capsuleId);
    if (!capsuleData) {
      throw new Error("Capsule data not found");
    }
    return JSON.parse(capsuleData);
  } catch (error) {
    console.error("Error retrieving capsule data:", error);
    throw error;
  }
};

export { storeCapsuleData, retrieveCapsuleData };
