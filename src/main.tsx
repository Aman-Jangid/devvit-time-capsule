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
          <image url="logo.png" imageHeight={300} imageWidth={300} />
          <text size="large">🛠️ Creating time capsule...just a moment. </text>
        </vstack>
      ),
    });
    ui.navigateTo(post);
  },
});

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

    const form = useForm(
      {
        title: "Time capsule creator",
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
            name: "revealDate",
            type: "string",
            label: "Reveal Date",
            required: true,
            defaultValue: formContent.revealDate,
          },
          {
            name: "capsuleImage",
            type: "image",
            label: "Image (optional)",
            required: false,
          },
          {
            name: "capsuleTheme",
            type: "select",
            label: "Theme",
            options: [
              { label: "General", value: "General" },
              { label: "Prediction", value: "Prediction" },
              { label: "Advice", value: "Advice" },
              { label: "Announcement", value: "Announcement" },
              { label: "Story", value: "Story" },
              { label: "Challenge", value: "Challenge" },
              { label: "Other", value: "Other" },
            ],
            required: true,
            defaultValue: formContent.theme,
          },
        ],
      },
      ({
        capsuleTitle,
        capsuleDescription,
        capsuleImage,
        capsuleTheme,
        revealDate,
      }) => {
        setFormContent({
          title: capsuleTitle,
          description: capsuleDescription,
          revealDate: revealDate,
          image: capsuleImage,
          theme: capsuleTheme,
        });
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
            <image
              url="background.jpg"
              imageHeight={500}
              imageWidth={500}
              height="100%"
              width="100%"
              resizeMode="cover"
            />
            <vstack height="100%" width="100%" alignment="middle center">
              <button onPress={() => context.ui.showForm(form)}>
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
              <text size="large">
                Are you sure about the capsule's content?
              </text>
              <spacer height={5} />
              <button onPress={() => buryCapsule()}>Yes, Bury Capsule</button>
              <button onPress={() => context.ui.showForm(form)}>
                No, Edit Content..
              </button>
              <spacer height={5} />
            </vstack>
          </>
        ) as any;
        break;
      // 2: Bury capsule
      case 2:
        content = (
          <vstack height="100%" width="100%" alignment="middle center">
            <text size="large">Burying your time capsule....</text>
          </vstack>
        ) as any;
        break;
      // 3: Success message
      case 3:
        content = (
          <vstack height="100%" width="100%" alignment="middle center">
            <text size="large">Your time capsule was successfully buried!</text>
            <spacer height={5} />
            <text size="medium">
              It will be revealed to the @community on{" "}
              <text weight="bold" size="large">
                12/12/2025
              </text>
              ,
            </text>
            <text size="medium">
              You will be notified 10 minutes before the reveal.
            </text>
            <spacer height={10} />
            <button onPress={() => context.ui.navigateTo("")}>
              See your post {"->"}
            </button>
          </vstack>
        ) as any;
        break;
      // 4: Error message
      case 4:
        content = (
          <vstack height="100%" width="100%" alignment="middle center">
            <text size="large">
              We are facing some issues creating your time capsule please check
              back a few minutes later. {":("}
            </text>
            <button onPress={() => setPage(0)}>Okay :|</button>
          </vstack>
        ) as any;
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
