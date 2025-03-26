import {
  Devvit,
  RichTextBuilder,
  useForm,
  useInterval,
  useState,
} from "@devvit/public-api";

import { CAPSULE_THEMES } from "./constants.js";

import {
  retrieveCapsuleData,
  storeCapsuleData,
  updateCapsuleData,
} from "./server/redis.js";

import { formatDate, getCurrentDate } from "./utils/formatDate.js";

Devvit.configure({
  redditAPI: true,
  redis: true,
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

// Schedule reveal of the contents of the time capsule
Devvit.addSchedulerJob({
  name: "revealTimeCapsule",
  onRun: async (event, context) => {
    const { capsuleId, username } = event.data as {
      capsuleId: string;
      username: string;
    };

    if (!capsuleId || !username) {
      console.error("Invalid capsule data", event.data);
      return;
    }

    try {
      const capsuleData = await context.redis.get(capsuleId);

      if (!capsuleData) {
        console.error("Capsule data not found for capsuleId:", capsuleId);
        return;
      }

      const data = JSON.parse(capsuleData);

      let bestGuesses: string[];

      // fetch and filter comments
      try {
        const post = await context.reddit.getPostById(capsuleId);
        const comments = await post.comments.all();

        bestGuesses = comments
          .filter((comment) => comment.body.startsWith("Guess:"))
          .sort((a, b) => b.score - a.score)
          .slice(0, 2)
          .map(
            (comment) =>
              `${comment.authorName} - ${comment.score} votes - ${comment.body}`
          );
      } catch (e) {
        console.error("Error fetching best guesses:", e);
      }

      const subredditName = await context.reddit.getCurrentSubredditName();

      // Create reveal post
      const revealPost = await context.reddit.submitPost({
        subredditName,
        title: `Time-Capsule Reveal: "${data.title}" by u/${username}`,
        richtext: new RichTextBuilder()
          .heading({ level: 2 }, () => {
            return `${data.title}`;
          })
          .paragraph(() => {
            return `This post is a time capsule reveal. It was buried on ${new Date().toLocaleDateString()} and will be opened on ${
              data.revealDate
            }.`;
          })
          .image({ mediaId: data.image })
          .paragraph(() => {
            return `The top 2 guesses were:`;
          })
          .list({ ordered: true }, () =>
            bestGuesses.length ? bestGuesses : ["No guesses were made"]
          ),
      });

      await revealPost.approve();
    } catch (e) {
      console.error("Failed to reveal the time capsule:", capsuleId, e);
    }
  },
});

// Schedule Notification (Private Message)
Devvit.addSchedulerJob({
  name: "sendNotification",
  onRun: async (event, context) => {
    const { user, author, title, revealDate } = event.data as {
      user: string;
      author: string;
      title: string;
      revealDate: string;
    };

    if (!user) {
      console.error("Username not available for notification");
      return;
    }

    try {
      const subredditName = await context.reddit.getCurrentSubredditName();
      await context.reddit.sendPrivateMessageAsSubreddit({
        to: user,
        subject: "Time Capsule Reminder",
        text: `Time capsule "${title}" by ${author} buried in r/${subredditName} will be revealed on ${revealDate} in 2 minutes.`,
        fromSubredditName: subredditName,
      });
    } catch (error) {
      console.error(`Failed to send notification to ${user}:`, error);
    }
  },
});

// Main post type for the time capsule
Devvit.addCustomPostType({
  name: "timeCapsule",
  height: "regular",
  render: (context) => {
    // Constants
    const CURRENT_SUBREDDIT_NAME = context.subredditName || "";
    const CURRENT_POST_ID = context.postId || "";
    const DEFAULT_FORM_CONTENT = {
      title: "",
      description: "",
      revealDate: "",
      image: "" as any,
      theme: CAPSULE_THEMES[0],
    };

    // State
    const [page, setPage] = useState<number>(0);
    const [backgroundUrl, setBackgroundUrl] =
      useState<string>("background.jpg");
    const [error, setError] = useState<string>("");
    const [currentUsername, setCurrentUsername] = useState<string>("");
    const [time, setTime] = useState<string>("");
    const [formContent, setFormContent] = useState(async () => {
      try {
        const data = await retrieveCapsuleData(context, CURRENT_POST_ID);
        if (!data) return DEFAULT_FORM_CONTENT;
        if (data.buried) setPage(6);
        return data;
      } catch (e) {
        console.error("Error getting post data:", e);
        return DEFAULT_FORM_CONTENT;
      }
    });

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

    // Intervals
    const buryingInterval = useInterval(() => {
      setPage(3);
      setMainBackground();
      buryingInterval.stop();
    }, 3500);
    const getCurrentTime = () => {
      // countdown to reveal date (YYYY-MM-DD HH:MM:SS)

      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      setTime(`${hours}:${minutes}:${seconds}`);
    };

    useInterval(getCurrentTime, 1000).start();

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
            defaultValue: formContent?.title || "",
          },
          {
            name: "capsuleDescription",
            type: "paragraph",
            label: "Description",
            required: true,
            defaultValue: formContent?.description || "",
          },
          {
            name: "capsuleRevealDate",
            type: "string",
            label: "Reveal Date",
            helpText: "Format: MM/DD/YYYY HH:MM AM/PM",
            placeholder: "12/12/2025 12:00 AM",
            required: true,
            defaultValue: formContent?.revealDate || getCurrentDate(),
          },
          {
            name: "capsuleTheme",
            type: "select",
            label: "Type of content inside the capsule",
            options: CAPSULE_THEMES,
            required: true,
            defaultValue: formContent?.theme || CAPSULE_THEMES[0],
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

        // storing form data in redis
        const stored = await storeCapsuleData(
          context,
          CURRENT_POST_ID,
          JSON.stringify({ ...data, buried: false })
        );

        if (!stored) {
          setError("Failed to store capsule data");
          setPage(4);
          return;
        }

        setPage(1);
      }
    );

    // Form for guessing
    const guessForm = useForm(
      {
        acceptLabel: "Guess",
        cancelLabel: "Later",
        title: "Guess the contents of the time capsule",
        fields: [
          {
            name: "guess",
            type: "string",
            label: "Your Guess",
            required: true,
          },
        ],
      },
      async (data) => {
        try {
          const post = await context.reddit.getPostById(CURRENT_POST_ID);
          await (
            await post.addComment({ text: `Guess: ${data.guess}` })
          ).approve();
          (await post.addComment({ text: `Guess: ${data.guess}` })).approve();
          context.ui.showToast("Your guess has been submitted!");
        } catch (e) {
          console.error("Error trying to guess on the post:", e);
        }
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

        setCurrentUsername(
          (await context.reddit.getCurrentUsername()) as string
        );

        // Scheduling the reveal of the time capusle
        await context.scheduler.runJob({
          name: "revealTimeCapsule",
          data: {
            capsuleId: CURRENT_POST_ID,
            username: currentUsername,
          },
          runAt: formattedRevealDate,
        });

        setPage(2);
        updateCapsuleData(context, CURRENT_POST_ID, {
          ...formContent,
          buried: true,
        });
      } catch (e) {
        console.error("Error burying capsule:", e);
        setError(e instanceof Error ? e.message : String(e));
        setPage(4);
      }
    };

    const notifyUser = async () => {
      try {
        const user = await context.reddit.getCurrentUsername();

        if (!user) {
          console.error("Failed to get current user");
          return;
        }
        await context.scheduler.runJob({
          name: "sendNotification",
          data: {
            user,
            author: currentUsername,
            title: formContent.title || "Dummy title",
            revealDate: formContent.revealDate || "03/25/25 10:05 PM",
          },
          // run 2 minute later than current time
          runAt: new Date(Date.now() + 120000),
        });
      } catch (e) {
        console.error("Error notifying user:", e);
      }
    };

    // TODO : Testing stuff
    const test = async () => {};

    // extract the data from the form and create the post
    let content = <></>;

    // navigation
    switch (page) {
      // -1: Loading
      default:
        console.log("LOADING........");
        // TODO : set background to loading.gif
        break;
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
            <button onPress={() => setPage(6)}>See teaser {"->"}</button>
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
        // set background based on the theme
        setBackgroundUrl(formContent.theme[0].toLowerCase() + ".jpg");

        content = (
          <vstack height="100%" width="100%" alignment="middle center">
            <text size="xxlarge">Teaser</text>
            <text size="xlarge">Time capsule buried by {currentUsername}</text>
            <spacer height={10} />
            <text size="xlarge">
              Will be revealed on the subreddit {CURRENT_SUBREDDIT_NAME} on{" "}
              {formContent.revealDate}
            </text>
            <spacer height={10} />
            <vstack width="100%" alignment="middle center">
              <vstack>
                <text>Click below to notify you before the reveal.</text>
                <button onPress={notifyUser}>Remind me!</button>
              </vstack>
              <vstack>
                <text>Guess what's inside the capsule!</text>
                <button
                  onPress={() =>
                    context.ui.showForm(guessForm, { title: "Guess" })
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
