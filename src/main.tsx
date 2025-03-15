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
  },
});

// Main post type for the time capsule
Devvit.addCustomPostType({
  name: "timeCapsule",
  height: "regular",
  render: (context) => {
    const [page, setPage] = useState(0);
    const [formContent, setFormContent] = useState({
      title: "",
      description: "",
      revealDate: "",
      image: "" as any,
      theme: [""],
    });
    const [backgroundUrl, setBackgroundUrl] = useState("background.jpg");
    const [error, setError] = useState("");

    const CURRENT_SUBREDDIT_NAME = context.subredditName || "";
    const CURRENT_POST_ID = context.postId || "";

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
            defaultValue: formContent.title,
          },
          {
            name: "capsuleDescription",
            type: "paragraph",
            label: "Description",
            required: true,
            defaultValue: formContent.description,
          },
          {
            name: "capsuleRevealDate",
            type: "string",
            label: "Reveal Date",
            helpText: "Format: MM/DD/YYYY::HH:MM AM/PM",
            placeholder: "12/12/2025::12:00 AM",
            required: true,
            defaultValue: formContent.revealDate,
          },
          {
            name: "capsuleTheme",
            type: "select",
            label: "Type of content inside the capsule",
            options: [
              { label: "Prediction", value: "Prediction" },
              { label: "Announcement", value: "Announcement" },
              { label: "Nostalgia", value: "Nostalgia" },
              { label: "Challenge", value: "Challenge" },
              { label: "Other", value: "Other" },
            ],
            required: true,
            defaultValue: formContent.theme,
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
        await context.redis.set(capsuleId, JSON.stringify(data), {});
        // create post
        try {
        } catch (e) {
          setError(e as any); // setError(e); later - display on error page
          setPage(4);

          return;
        }

        setPage(1);
      }
    );

    const buryingInterval = useInterval(() => {
      setPage(3);
      setBackgroundUrl("background.jpg");
      buryingInterval.stop();
    }, 3500);

    const buryCapsule = async () => {
      setPage(2);
      setBackgroundUrl("digging.gif");
      buryingInterval.start();
    };

    let content = <></>;

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
            </vstack>
          </>
        ) as any;
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
                  {"( Creating in  "}
                </text>
                <text size="large" color="orange" weight="bold">
                  {CURRENT_SUBREDDIT_NAME}
                </text>
                <text size="large" weight="bold">
                  {"  subreddit. )"}
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
        ) as any;
        break;
      // 2: Bury capsule
      case 2:
        content = (
          <vstack height="100%" width="100%" alignment="middle center">
            <text size="xlarge">Burying your time capsule....</text>
          </vstack>
        ) as any;
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
                  `https://www.reddit.com/r/${CURRENT_SUBREDDIT_NAME}/comments/${CURRENT_POST_ID}/`
                )
              }
            >
              See your post {"->"}
            </button>
          </vstack>
        ) as any;
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
            <button onPress={() => buryCapsule()}>Retry</button>
            <spacer height={8} />
            <button onPress={() => setPage(0)}>Go Back</button>
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
        ) as any;
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
