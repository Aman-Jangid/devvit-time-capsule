import { Devvit } from "@devvit/public-api";

const sendNotificationToUser = async (
  context: Devvit.Context,
  message: any
) => {
  const username = await context.reddit.getCurrentUsername();
  if (!username) return;

  try {
    await context.reddit.sendPrivateMessageAsSubreddit({
      to: username,
      subject: "Time Capsule Reveal",
      text: message,
      fromSubredditName: context.subredditName || "",
    });
    console.log(`Notification sent to ${username}`);
  } catch (error) {
    console.error(`Failed to send notification to ${username}:`, error);
  }
};

export { sendNotificationToUser };
