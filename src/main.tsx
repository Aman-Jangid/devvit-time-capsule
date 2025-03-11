// Learn more at developers.reddit.com/docs
import {
  Devvit,
  RichTextBuilder,
  useAsync,
  useForm,
  useInterval,
  useState,
} from "@devvit/public-api";

Devvit.configure({
  redditAPI: true,
  realtime: true,
  redis: true,
  media: true,
});

// Add a menu item to the subreddit menu for instantiating the new experience post
Devvit.addMenuItem({
  label: "Create Time Capsule",
  location: "subreddit",
  forUserType: "moderator",
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    ui.showToast(
      "Constructing a new time capsule factory - upon completion you'll be able to create time capsules."
    );

    const subreddit = await reddit.getCurrentSubreddit();
    const post = await reddit.submitPost({
      title: "Time Capsule",
      subredditName: subreddit.name,
      preview: (
        <vstack height="100%" width="100%" alignment="middle center">
          <text size="large">🛠️ Creating time capsule...just a moment. </text>
        </vstack>
      ),
    });
    ui.navigateTo(post);
  },
});

// Schedule the reveal
Devvit.addSchedulerJob({
  name: "revealCapsule",

  onRun: async (event, context) => {
    if (
      !event.data ||
      typeof event.data !== "object" ||
      !("capsuleId" in event.data) ||
      !("teaserPostId" in event.data) ||
      !("username" in event.data)
    ) {
      console.error("Invalid event data");
      return;
    }
    const { capsuleId, teaserPostId, username } = event.data as {
      capsuleId: string;
      teaserPostId: string;
      username: string;
    };

    const capsuleData = await context.redis.get(capsuleId);
    if (!capsuleData) {
      console.error("Capsule data not found");
      return;
    }

    const data = JSON.parse(capsuleData);
    const comments = await context.reddit.getComments({
      postId: teaserPostId,
      limit: 100,
    });

    const guesses = comments.children
      .filter((comment) => comment.body.startsWith("Guess:"))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(
        (comment) =>
          `${comment.authorName} - ${comment.score} votes - ${comment.body}`
      );
    // Create reveal post
    const post = await context.reddit.submitPost({
      subredditName: context.subredditName || "",
      title: `Time Capsule: ${
        data.title
      } Revealed by u/${await context.reddit.getUserByUsername(username)}`,
      text: `**Title:** ${data.title}\n\n**Description:** ${data.description}\n\n**Reveal Date:** ${data.revealDate}\n\n**Theme:** ${data.theme}`,
    });

    // Update the teaser post with the reveal post link
    const teaserPost = await context.reddit.getPostById(teaserPostId);
    teaserPost.edit({
      text:
        teaserPost.title +
        `\n\n[Reveal Post](https://reddit.com${post.permalink})`,
    });
  },
});

// useful stuff
// Devvit.addTrigger({event:"AppInstall",onEvent:()=>{}})

// REVEAL POST : convert to richtext post with capsule details
// Devvit.addCustomPostType({
//   name: "timeCapsuleReveal",
//   height: "regular",
//   render: (context) => {
//     const [timeRemaining, setTimeRemaining] = useState("");
//     const capsuleId = context.postId || "";

//     const {
//       data: capsuleData,
//       error,
//       loading,
//     } = useAsync(
//       () =>
//         context.redis.get(capsuleId).then((data) => {
//           return data ? JSON.parse(data) : null;
//         }),
//       { depends: [capsuleId] }
//     );

//     useInterval(() => {
//       if (capsuleData) {
//         const revealDate = new Date(capsuleData.revealDate);
//         const now = new Date();
//         const timeDiff = revealDate.getTime() - now.getTime();

//         if (timeDiff > 0) {
//           setTimeRemaining(
//             `${Math.floor(timeDiff / (1000 * 60 * 60 * 24))} days, ${Math.floor(
//               (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
//             )} hours, ${Math.floor(
//               (timeDiff % (1000 * 60 * 60)) / (1000 * 60)
//             )} minutes`
//           );
//         } else {
//           setTimeRemaining("Time Capsule Revealed");
//         }
//       }
//     }, 2000);

//     console.log(loading, error);

//     if (loading) {
//       return (
//         <vstack
//           height="100%"
//           width="100%"
//           gap="medium"
//           alignment="center middle"
//         >
//           <text>Loading...</text>
//         </vstack>
//       );
//     }

//     if (error || !capsuleData) {
//       return (
//         <vstack
//           height="100%"
//           width="100%"
//           gap="medium"
//           alignment="center middle"
//         >
//           <text>Error loading capsule data</text>
//         </vstack>
//       );
//     }

//     return (
//       <vstack height="100%" width="100%" gap="medium" alignment="center middle">
//         <text>Time Capsule Reveal : {timeRemaining}</text>
//       </vstack>
//     );
//   },
// });

Devvit.addCustomPostType({
  name: "timeCapsule",
  height: "regular",
  render: (context) => {
    const form = useForm(
      {
        fields: [
          {
            type: "string",
            name: "title",
            label: "Capsule Title",
            required: true,
          },
          {
            type: "paragraph",
            name: "description",
            label: "Tell us about your capsule",
            required: true,
          },
          {
            type: "string",
            name: "revealDate",
            label: "Reveal Date (YYYY-MM-DD)",
            required: true,
          },
          {
            type: "select",
            name: "theme",
            label: "Theme",
            options: [
              { label: "Prediction", value: "Prediction" },
              { label: "Announcement", value: "Announcement" },
              { label: "Nostalgia", value: "Nostalgia" },
              { label: "Picture", value: "Picture" }, // TODO : if possible show inputs based on the selected option
            ],
            defaultValue: ["Prediction"],
          },
          {
            type: "image",
            name: "image",
            label: "Upload an image",
            required: false,
          },
        ],
        acceptLabel: "Bury Capsule",
        cancelLabel: "Later",
        title: "Create Time Capsule",
        description: "Fill out the contents of your time capsule",
      },
      async (data) => {
        // 1. Create unique capsule ID
        const capsuleId = Date.now().toString();

        // 2. Store capsule data in Redis (can be retrieved using the capsule ID)
        await context.redis.set(capsuleId, JSON.stringify(data));

        // 3. Create a teaser post
        const post = await context.reddit.submitPost({
          subredditName: await context.reddit.getCurrentSubredditName(),
          // get flair id by getting all flairs and filtering by name (for testing only)
          flairId: await context.reddit
            .getPostFlairTemplates("testmygame098")
            .then((flairs) => {
              return flairs.find((flair) => flair.text === "prediction")?.id; // TODO : get flair id based on the selected theme
            }),
          title: `Time Capsule: ${
            data.title
          } by u/${await context.reddit.getCurrentUsername()}`,
          richtext: new RichTextBuilder()
            .heading({ level: 2 }, async () => {
              return `Time Capsule: ${
                data.title
              } by u/${await context.reddit.getCurrentUsername()}`;
            })
            .paragraph(async () => {
              return `This post is a time capsule. It will be opened on ${data.revealDate}`;
            }),
        });

        const currentUsername = await context.reddit.getCurrentUsername();

        // 4. Schedule the reveal
        await context.scheduler.runJob({
          name: "revealCapsule",
          // runAt: new Date(data.revealDate),
          // run 10 seconds after form submission (for testing)
          runAt: new Date(Date.now() + 10000),
          data: {
            capsuleId,
            teaserPostId: post.id,
            username: currentUsername ? currentUsername.toString() : "",
          },
        });
      }
    );

    return (
      <zstack height="100%" width="100%">
        <image
          width={100}
          height={100}
          imageHeight={100}
          imageWidth={100}
          resizeMode="cover"
          url="https://preview.redd.it/i-work-at-reddit-creating-and-directing-art-on-the-brand-v0-l40z01pju1cc1.jpg?width=640&crop=smart&auto=webp&s=14df0a7ce79423e9c24fd7d3f616f5a8bc619a4c"
        />
        <vstack
          height="100%"
          width="100%"
          gap="medium"
          alignment="center middle"
        >
          <button onPress={() => context.ui.showForm(form)}>
            Create Time Capsule
          </button>
        </vstack>
      </zstack>
    );
  },
});

export default Devvit;

// FLOW :
// 1. User clicks on "Create Time Capsule" menu item - DONE
// 2. User fills out the form and submits - DONE
// 3. A teaser post is created with the capsule details (Generate an image based on the theme and the public datails of the capsule)
// 4. The reveal post is scheduled to be created at the reveal date
// 5. The teaser post is updated with the reveal post link
// 6. The reveal post is created at the reveal date
// 7. The reveal post is updated with the capsule details

// TODO :
// 0. There should be a feedback message when the capsule is created
// 1. Add flair to the teaser post based on the theme
// 2. Add image to the teaser post
// 3. Add image to the reveal post
// 4. Add comments to the teaser post
// 5. Add comments to the reveal post
// 6. Add reactions to the teaser post
// 7. Add reactions to the reveal post
// 8. Add a button to the teaser post to open the reveal post
// 9. Add a button to the reveal post to open the teaser post
// 10. Add a button to the teaser post to open the capsule data
// 11. Allow guessing in the comments by using a bot
// 12. Allow voting in the comments by using a bot
// 13. Change the capsule status to "opened" after the reveal date
// 14. Keep history of all capsules created - by a user, in a subreddit etc.
