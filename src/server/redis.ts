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

const retrieveCapsuleData = async (context: Devvit.Context, capsuleId: any) => {
  try {
    const capsuleData = await context.redis.get(capsuleId);
    if (!capsuleData) {
      return null;
    }
    return JSON.parse(capsuleData);
  } catch (error) {
    console.error("Error retrieving capsule data:", error);
    throw error;
  }
};

const updateCapsuleData = async (
  context: Devvit.Context,
  capsuleId: any,
  data: any
) => {
  try {
    await context.redis.set(capsuleId, JSON.stringify(data), {});
    return true;
  } catch (error) {
    console.error("Error updating capsule data:", error);
    return false;
  }
};

export { storeCapsuleData, retrieveCapsuleData, updateCapsuleData };
