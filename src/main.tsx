// Learn more at developers.reddit.com/docs
import {
  Devvit,
  RichTextBuilder,
  useForm,
  useInterval,
  useState,
} from "@devvit/public-api";
import { CAPSULE_THEMES } from "./constants.js";
import { storeCapsuleData } from "./server/redis.js";
import { formatDate, getCurrentDate } from "./utils/formatDate.js";
import { createTeaserPost } from "./server/posts.js";

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
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    ui.showToast(
      "Constructing a new time capsule factory - upon completion you'll be able to create time capsules."
    );

    try {
      const subreddit = await reddit.getCurrentSubreddit();
      const post = await reddit.submitPost({
        title: "Time Capsule",
        subredditName: subreddit.name,
        preview: (
          <vstack height="100%" width="100%" alignment="middle center">
            <image
              url="logo.png"
              imageHeight={300}
              imageWidth={300}
              resizeMode="cover"
            />
          </vstack>
        ),
      });
      ui.navigateTo(post);
    } catch (e) {
      console.error(e);
      ui.showToast("An error occurred while creating the time capsule.");
    }
  },
});

// schedular to reveal the time capsule contents
Devvit.addSchedulerJob({
  name: "revealTimeCapsule",
  onRun: async (event, context) => {
    // send notifications to list of users
    const sendNotification = async (usernames: string) => {
      // const users = await context.redis.get() // get list of users who upvoted the post
      usernames.split(",").forEach(async (username) => {
        await context.reddit.sendPrivateMessageAsSubreddit({
          to: username,
          subject: "Time Capsule Reveal",
          text: `Your time capsule will be revealed in 10 minutes.`,
          fromSubredditName: context.subredditName || "",
        });
      });
    };

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

    console.log("Revealing time capsule", capsuleId, teaserPostId, username);

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

    // list top 2 guesses
    const guesses = comments.children
      .filter((comment) => comment.body.startsWith("Guess:"))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(
        (comment) =>
          `${comment.authorName} - ${comment.score} votes - ${comment.body}`
      );

    // create reveal post
    const revealPost = await context.reddit.submitPost({
      subredditName: context.subredditName || "",
      title: `Time Capsule Reveal: ${data.title} by u/${username}`,
      richtext: new RichTextBuilder()
        .heading({ level: 2 }, async () => {
          return `Time Capsule Reveal: ${data.title} by u/${username}`;
        })
        .paragraph(async () => {
          return `This post is a time capsule reveal. It was buried on ${new Date().toLocaleDateString()} and will be opened on ${
            data.revealDate
          }.`;
        })
        .paragraph(async () => {
          return `The top 2 guesses were:`;
        })
        .list({ ordered: true }, async () => guesses),
    });

    // Update the teaser post with the reveal post link
    const teaserPost = await context.reddit.getPostById(teaserPostId);
    teaserPost.edit({
      text:
        teaserPost.title +
        `\n\n[Reveal Post](https://reddit.com${"post.permalink"})`,
    });
  },
});

// const remindMeHandler = async (capsuleId, userId, context) => {
//   const capsuleData = await context.redis.get(`capsule:${capsuleId}`);
//   if (!capsuleData) return;

//   const capsule = JSON.parse(capsuleData);
//   const revealDate = new Date(capsule.revealTime);

//   await context.scheduler.runAt({
//     name: 'send_reminder',
//     data: {
//       userId,
//       capsuleId,
//       theme: capsule.theme
//     },
//     runAt: revealDate,
//   });

//   context.ui.showToast('You will be reminded when this capsule is revealed!');
// };

// Devvit.addSchedulerJob({
//   name: "send_reminder",
//   onRun: async (event, context) => {
//     const { userId, capsuleId, theme } = event.data;

//     // Send a private message to the user
//     await context.reddit.sendPrivateMessage({
//       to: userId,
//       subject: "Time Capsule Reminder",
//       text: `The time capsule "${theme}" has been revealed! Check it out in the subreddit.`,
//     });
//   },
// });

// Main post type for the time capsule
Devvit.addCustomPostType({
  name: "timeCapsule",
  height: "regular",
  render: (context) => {
    // State
    const [page, setPage] = useState(0);
    const [backgroundUrl, setBackgroundUrl] = useState("background.jpg");
    const [error, setError] = useState("");
    const [teaserPostId, setTeaserPostId] = useState("");
    const [formContent, setFormContent] = useState({
      title: "",
      description: "",
      revealDate: "",
      image: "" as any,
      theme: [""],
    });
    const [buried, setBuried] = useState(true);
    const [author, setAuthor] = useState("");

    // Constants
    const CURRENT_SUBREDDIT_NAME = context.subredditName || "";
    const CURRENT_POST_ID = context.postId || "";

    // UI helpers
    const setMainBackground = () => {
      setBackgroundUrl("background.jpg");
    };

    const showBuryingAnimation = () => {
      setBackgroundUrl("digging.gif");
    };

    const returnToMainPage = () => {
      setMainBackground();
      setPage(0);
    };

    const buryingInterval = useInterval(() => {
      setPage(3);
      setMainBackground();
      buryingInterval.stop();
    }, 3500);

    // set splash image for the post
    (async () => {
      try {
        const post = await context.reddit.getPostById(CURRENT_POST_ID);
        post.setCustomPostPreview(() => (
          <vstack height="100%" width="100%" alignment="middle center">
            <image
              url="splash.jpg"
              imageHeight={500}
              imageWidth={900}
              resizeMode="cover"
            />
          </vstack>
        ));
      } catch (e) {
        console.error("Error setting splash image:", e);
      }
    })();

    // get post status
    (async () => {
      try {
        if (buried) {
          setPage(6);
          return;
        }
      } catch (e) {
        console.error("Error getting post status:", e);
      }
    })();

    // Form for creating the time capsule post
    const form = useForm(
      {
        acceptLabel: "Bury Capsule",
        cancelLabel: "Later",
        title: "Create Time Capsule",
        fields: [
          {
            name: "capsuleTitle",
            type: "string",
            label: "Title",
            required: true,
            defaultValue: formContent.title || "",
          },
          {
            name: "capsuleDescription",
            type: "paragraph",
            label: "Description",
            required: true,
            defaultValue: formContent.description || "",
          },
          {
            name: "capsuleRevealDate",
            type: "string",
            label: "Reveal Date",
            helpText:
              "Format: MM/DD/YYYY HH:MM AM/PM (or any other with spaces in between)",
            placeholder: "12/12/2025 12:00 AM",
            required: true,
            defaultValue: formContent.revealDate || getCurrentDate(),
          },
          {
            name: "capsuleTheme",
            type: "select",
            label: "Type of content inside the capsule",
            options: CAPSULE_THEMES,
            required: true,
            defaultValue: formContent.theme || CAPSULE_THEMES[0],
          },
          {
            name: "capsuleImage",
            type: "image",
            label: "Image (optional)",
            required: false,
          },
        ],
      },
      async (data) => {
        setFormContent({
          title: data.capsuleTitle,
          description: data.capsuleDescription,
          revealDate: data.capsuleRevealDate,
          image: data.capsuleImage,
          theme: data.capsuleTheme,
        });

        // get post id
        const capsuleId = Date.now().toString();
        const stored = await storeCapsuleData(
          context,
          capsuleId,
          JSON.stringify(data)
        );

        if (!stored) {
          setError("Failed to store capsule data");
          setPage(4);
          return;
        }

        setPage(1);
      }
    );

    const buryCapsule = async () => {
      try {
        if (!formContent) {
          throw new Error("Invalid form data");
        }
        if (!formContent.revealDate) {
          throw new Error(
            "Invalid reveal date format : " + formContent.revealDate
          );
        }

        const formattedRevealDate = formatDate(formContent.revealDate);

        const CURRENT_USERNAME =
          (await context.reddit.getCurrentUsername()) as string;

        setAuthor(CURRENT_USERNAME);

        const newTeaserPostId = await createTeaserPost(
          context,
          {
            capsuleTitle: formContent.title,
            capsuleRevealDate: formattedRevealDate.toString(),
          },
          CURRENT_USERNAME
        );

        setTeaserPostId(newTeaserPostId);

        // Scheduling the reveal of the time capusle
        await context.scheduler.runJob({
          name: "revealTimeCapsule",
          data: {
            capsuleId: CURRENT_POST_ID,
            teaserPostId: newTeaserPostId,
            username: CURRENT_USERNAME,
          },
          runAt: formattedRevealDate,
        });

        setPage(2);
        setBuried(true);
      } catch (e) {
        console.error("Error burying capsule:", e);
        setError(e instanceof Error ? e.message : String(e));
        setPage(4);
      }
    };

    // TODO : Testing stuff
    const test = async () => {};

    // extract the data from the form and create the post
    let content = <></>;

    // navigation
    switch (page) {
      // 0: Main
      case 0:
        content = (
          <>
            <hstack
              width="100%"
              height="100%"
              alignment="top start"
              padding="medium"
            >
              <text size="medium" weight="bold">
                {`<Time Capsule ~ ${CURRENT_SUBREDDIT_NAME}>`}
              </text>
            </hstack>
            <hstack
              width="100%"
              height="100%"
              alignment="top end"
              padding="medium"
            >
              <icon name="help" size="large" onPress={() => setPage(5)} />
            </hstack>
            <vstack height="100%" width="100%" alignment="middle center">
              <button onPress={() => context.ui.showForm(form)} size="large">
                Create time capsule
              </button>
              <button onPress={test}>Click me to test!</button>
            </vstack>
          </>
        );
        break;
      // 1: Confirm capsule content
      case 1:
        content = (
          <>
            <vstack height="100%" width="100%" alignment="middle center">
              <text size="xlarge" weight="bold" wrap>
                Are you sure about the capsule's content?
              </text>
              <hstack grow={false} width="100%" alignment="middle center">
                <text size="large" weight="bold">
                  {"Creating in "}
                </text>
                <text size="large" color="orange" weight="bold">
                  {CURRENT_SUBREDDIT_NAME}
                </text>
                <text size="large" weight="bold">
                  {" subreddit."}
                </text>
              </hstack>
              <spacer height={12} />
              <button onPress={() => buryCapsule()}>Yes, Bury Capsule</button>
              <spacer height={8} />
              <button onPress={() => context.ui.showForm(form)}>
                No, Edit Content..
              </button>
              <spacer height={12} />
            </vstack>
          </>
        );
        break;
      // 2: Bury capsule
      case 2:
        showBuryingAnimation();
        content = (
          <vstack height="100%" width="100%" alignment="middle center">
            <text size="xlarge">Burying your time capsule....</text>
          </vstack>
        );
        buryingInterval.start();
        break;
      // 3: Success
      case 3:
        content = (
          <vstack
            height="100%"
            width="100%"
            alignment="middle center"
            padding="small"
          >
            <text size="xxlarge" wrap>
              Your time capsule was successfully buried!
            </text>
            <spacer height={15} />
            <text size="xlarge" weight="bold" wrap>
              It will be revealed to the {CURRENT_SUBREDDIT_NAME} on
            </text>
            <text weight="bold" size="xlarge" color="orange">
              {" " + formContent.revealDate + " "}
            </text>
            <spacer height={5} />
            <text size="xlarge" wrap>
              You will be notified 10 minutes before the reveal.
            </text>
            <spacer height={20} />
            <button
              onPress={() =>
                context.ui.navigateTo(
                  `https://www.reddit.com/r/${CURRENT_SUBREDDIT_NAME}/comments/${
                    teaserPostId || CURRENT_POST_ID
                  }/`
                )
              }
            >
              See your post {"->"}
            </button>
          </vstack>
        );
        break;
      // 4: Error
      case 4:
        content = (
          <vstack height="100%" width="100%" alignment="middle center">
            <text size="xlarge">
              We are facing some issues creating your time capsule please check
              back a few minutes later. {":("}
            </text>
            <spacer height={8} />
            <text size="xlarge">{error}</text>
            <spacer height={10} />
            <button onPress={buryCapsule}>Retry</button>
            <spacer height={8} />
            <button onPress={returnToMainPage}>Go Back</button>
          </vstack>
        ) as any;
        break;
      // 4: About
      case 5:
        content = (
          <vstack height="100%" width="100%" alignment="middle center">
            <vstack height="100%" width="60%" alignment="middle center">
              <text size="xxlarge">Time Capsule</text>
              <spacer height={10} />
              <text size="xlarge" wrap alignment="middle center">
                Create a time capsule to be revealed in the future.
              </text>
              <spacer height={5} />
              <text size="xlarge" wrap alignment="middle center">
                The time capsule will be buried in the subreddit you are
                currently in and will be revealed on the date you set.
              </text>
              <spacer height={5} />
              <text size="xlarge" wrap alignment="middle center">
                You will be notified 10 minutes before the reveal.
              </text>
              <spacer height={10} />
              <button onPress={() => setPage(0)}>Back</button>
            </vstack>
          </vstack>
        );
      // 5: Teaser
      case 6:
        let th = "nostalgia";
        // set background based on the theme
        switch (th) {
          // switch (formContent.theme[0]) {
          case "prediction":
            setBackgroundUrl("prediction.jpg");
            break;
          case "nostalgia":
            setBackgroundUrl("nostalgia.jpg");
            break;
          case "announcement":
            setBackgroundUrl("announcement.avif");
            break;
          case "other":
            setBackgroundUrl("other.jpg");
            break;
          default:
            setBackgroundUrl("default.jpg");
            break;
        }
        content = (
          <vstack height="100%" width="100%" alignment="middle center">
            <text size="xxlarge">Teaser</text>
            <text size="xlarge">Time capsule buried by {author}</text>
            <spacer height={10} />
            <text size="xlarge">
              Will be revealed on the subreddit {CURRENT_SUBREDDIT_NAME} on{" "}
              {formContent.revealDate}
            </text>
            <spacer height={10} />
            <vstack width="100%" alignment="middle center">
              <vstack>
                <text>
                  Click below to notify you 5 minutes before the reveal.
                </text>
                <button
                  onPress={() =>
                    console.log("Notify me 5 minutes before reveal")
                  }
                >
                  Remind me!
                </button>
              </vstack>
              <vstack>
                <text>Guess what's inside the capsule!</text>
                <button
                  onPress={() =>
                    context.ui.navigateTo(
                      `https://www.reddit.com/r/${CURRENT_SUBREDDIT_NAME}/comments/${
                        teaserPostId || CURRENT_POST_ID
                      }/`
                    )
                  }
                >
                  Guess
                </button>
              </vstack>
            </vstack>
          </vstack>
        );
        break;
    }

    return (
      <zstack width="100%" height="100%">
        <image
          resizeMode="cover"
          url={backgroundUrl}
          imageHeight={100}
          imageWidth={100}
          height="100%"
          width="100%"
        />

        {content}
      </zstack>
    );
  },
});

export default Devvit;
