import { Devvit } from "@devvit/public-api";

const createTeaserPost = async (
  context: Devvit.Context,
  data: { capsuleTitle: string; capsuleRevealDate: string },
  username: string
) => {
  try {
    const teaserPost = await context.reddit.submitPost({
      subredditName: context.subredditName || "",
      title: `Time Capsule: ${data.capsuleTitle} by u/${username}`,
      text: "This is a teaser post for the time capsule.",
    });
    return teaserPost.id;
  } catch (error) {
    console.error("Error creating teaser post:", error);
    throw error;
  }
};

export { createTeaserPost };
