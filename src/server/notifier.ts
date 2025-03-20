const sendNotificationToUsers = async (
  usernames: string,
  context: {
    reddit: {
      sendPrivateMessageAsSubreddit: (arg0: {
        to: any;
        subject: string;
        text: any;
        fromSubredditName: any;
      }) => any;
    };
    subredditName: any;
  },
  message: any
) => {
  if (!usernames) return;

  usernames.split(",").forEach(async (username: any) => {
    try {
      await context.reddit.sendPrivateMessageAsSubreddit({
        to: username,
        subject: "Time Capsule Reveal",
        text: message,
        fromSubredditName: context.subredditName || "",
      });
    } catch (error) {
      console.error(`Failed to send notification to ${username}:`, error);
    }
  });
};

export { sendNotificationToUsers };
