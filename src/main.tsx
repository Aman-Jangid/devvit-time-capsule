import { Devvit, useForm, useInterval, useState } from "@devvit/public-api";

import { CAPSULE_THEMES } from "./constants.js";

import { retrieveCapsuleData, storeCapsuleData } from "./server/redis.js";

import {
  convertToLocalTime,
  convertToUTC,
  countdown,
  getCurrentDate,
} from "./utils/time.js";

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
      "Initializing time capsule creation - your new capsule will be ready momentarily."
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
      ui.navigateTo(post);
    } catch (e) {
      console.error(e);
      ui.showToast("Failed to create time capsule. Please try again later.");
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
      // const subredditName = await context.reddit.getCurrentSubredditName();
      await context.reddit.sendPrivateMessage({
        to: user,
        subject: `Time Capsule Reveal: ${title}`,
        text: `The time capsule "${title}" created by u/${author} is about to be revealed at ${revealDate}!`,
        // fromSubredditName: subredditName,
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
      image: "",
      theme: CAPSULE_THEMES[0],
    };

    // TODO : Add pages for revealed content
    enum Pages {
      MAIN,
      CONFIRM,
      BURYING,
      SUCCESS,
      ERROR,
      ABOUT,
      TEASER,
      REVEAL,
      REVEAL_CONTENT,
      VIEW_IMAGE,
      DATETIME_SELECTOR,
    }

    // Intervals
    const buryingInterval = useInterval(() => {
      setPage(Pages.SUCCESS);
      setMainBackground();
      buryingInterval.stop();
    }, 3500);

    const timerInterval = useInterval(() => {
      if (formContent && formContent.buried && formContent.revealDate) {
        checkRevealTime(formContent.revealDate);
      }
      setTime(countdown(formContent.revealDate));
    }, 1000);

    timerInterval.start();

    const checkRevealTime = (revealDateString: string | number | Date) => {
      const revealDate = new Date(revealDateString);
      const now = new Date();

      // If we're already on the REVEAL_CONTENT page, don't change anything
      if (page === Pages.REVEAL_CONTENT) {
        return;
      }

      if (now.getTime() >= revealDate.getTime()) {
        // Only change to REVEAL if we're not already there
        if (page !== Pages.REVEAL) {
          setPage(Pages.REVEAL);
        }
      } else {
        // Only change to TEASER if we're not already there
        if (page !== Pages.TEASER) {
          setPage(Pages.TEASER);
        }
      }
    };

    // State
    const [page, setPage] = useState<number>(Pages.MAIN);
    const [backgroundUrl, setBackgroundUrl] =
      useState<string>("background.jpg");
    const [error, setError] = useState<string>("");
    const [currentUsername, setCurrentUsername] = useState<string>("");
    const [time, setTime] = useState<string>("");
    // TODO : paginate text content if it doesn't fit in the page
    // const [textContentPage, setTextContentPage] = useState<number>(0);

    const [formContent, setFormContent] = useState(async () => {
      try {
        const data = await retrieveCapsuleData(context, CURRENT_POST_ID);
        if (!data) return DEFAULT_FORM_CONTENT;

        if (data.buried) {
          // Initial check when the app loads
          checkRevealTime(data.revealDate);
        }
        return data;
      } catch (e) {
        console.error("Error getting post data:", e);
        return DEFAULT_FORM_CONTENT;
      }
    });
    const [dateTime, setDateTime] = useState({
      month: 1,
      day: 1,
      year: new Date().getFullYear(),
      hour: 12,
      minute: 0,
      ampm: "AM",
    } as any);

    // UI helpers
    const setMainBackground = () => {
      setBackgroundUrl("background.jpg");
    };
    const showBuryingAnimation = () => {
      setBackgroundUrl("digging.gif");
    };
    const setRevealBackground = () => {
      if (formContent.theme) {
        setBackgroundUrl(formContent.theme[0].toLowerCase() + ".jpg");
      }
    };
    const returnToMainPage = () => {
      setMainBackground();
      setPage(Pages.MAIN);
    };

    // Convert local date to UTC for storage

    // Update reveal date function
    const updateRevealDate = async (revealDate: string) => {
      // Convert to UTC before storing
      const utcRevealDate = convertToUTC(revealDate);
      setFormContent({ ...formContent, revealDate: utcRevealDate });
      await storeCapsuleData(
        context,
        CURRENT_POST_ID,
        JSON.stringify({ ...formContent, revealDate: utcRevealDate })
      );
    };

    const setInitialDateTime = () => {
      // Get current date/time and add 1 minute
      const now = new Date();
      now.setMinutes(now.getMinutes() + 1);

      // Format using the same logic as getCurrentDate
      const month = now.getMonth() + 1; // getMonth() is 0-indexed
      const day = now.getDate();
      const year = now.getFullYear();

      let hour = now.getHours();
      const ampm = hour >= 12 ? "PM" : "AM";

      // Convert to 12-hour format
      hour = hour % 12;
      hour = hour ? hour : 12; // the hour '0' should be '12'

      const minute = now.getMinutes();

      // Set the dateTime state
      setDateTime({
        month,
        day,
        year,
        hour,
        minute,
        ampm,
      });
    };

    // const getRevealDate = (
    //   formData: { capsuleTitle: string } & { capsuleDescription: string } & {
    //     capsuleTheme: string[];
    //   } & { capsuleImage?: string | undefined } & { [key: string]: any }
    // ) => {
    //   setPage(Pages.DATETIME_SELECTOR);
    //   setFormContent({ ...formContent, revealDate: getCurrentDate() });
    //   // get revealDate from dateTime

    //   const revealDate = new Date(
    //     Date.UTC(
    //       dateTime.year,
    //       dateTime.month - 1,
    //       dateTime.day,
    //       dateTime.ampm === "PM" && dateTime.hour !== 12
    //         ? dateTime.hour + 12
    //         : dateTime.ampm === "AM" && dateTime.hour === 12
    //         ? 0
    //         : dateTime.hour,
    //       dateTime.minute
    //     )
    //   );

    //   setFormContent({
    //     title: formData.capsuleTitle,
    //     description: formData.capsuleDescription,
    //     revealDate: revealDate.toISOString(),
    //     image: formData.capsuleImage,
    //     theme: formData.capsuleTheme,
    //   });
    // };

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
        // Store the form data temporarily without setting page to CONFIRM
        const stored = await storeCapsuleData(
          context,
          CURRENT_POST_ID,
          JSON.stringify({ ...data, buried: false })
        );

        if (!stored) {
          setError("Failed to store capsule data");
          setPage(Pages.ERROR);
          return;
        }

        // Set form content without the reveal date yet
        setFormContent({
          title: data.capsuleTitle,
          description: data.capsuleDescription,
          image: data.capsuleImage,
          theme: data.capsuleTheme,
        });

        setInitialDateTime();

        // Navigate to datetime selector
        setPage(Pages.DATETIME_SELECTOR);
      }
    );

    // individual forms
    const editTitleForm = useForm(
      {
        acceptLabel: "Save",
        cancelLabel: "Cancel",
        title: "Edit Title",
        fields: [
          {
            name: "title",
            type: "string",
            label: "Title",
            required: true,
            defaultValue: formContent.title,
          },
        ],
      },
      async (data) => {
        setFormContent({ ...formContent, title: data.title });
        await storeCapsuleData(
          context,
          CURRENT_POST_ID,
          JSON.stringify({ ...formContent, title: data.title })
        );
      }
    );

    const editDescriptionForm = useForm(
      {
        acceptLabel: "Save",
        cancelLabel: "Cancel",
        title: "Edit Description",
        fields: [
          {
            name: "description",
            type: "paragraph",
            label: "Description",
            required: true,
            defaultValue: formContent.description,
          },
        ],
      },
      async (data) => {
        setFormContent({ ...formContent, description: data.description });
        await storeCapsuleData(
          context,
          CURRENT_POST_ID,
          JSON.stringify({ ...formContent, description: data.description })
        );
      }
    );

    const editThemeForm = useForm(
      {
        acceptLabel: "Save",
        cancelLabel: "Cancel",
        title: "Edit Theme",
        fields: [
          {
            name: "theme",
            type: "select",
            label: "Theme",
            options: CAPSULE_THEMES,
            required: true,
            defaultValue: formContent.theme,
          },
        ],
      },
      async (data) => {
        setFormContent({ ...formContent, theme: data.theme });
        await storeCapsuleData(
          context,
          CURRENT_POST_ID,
          JSON.stringify({ ...formContent, theme: data.theme })
        );
      }
    );

    const editImageForm = useForm(
      {
        acceptLabel: "Save",
        cancelLabel: "Cancel",
        title: "Edit Image",
        fields: [
          {
            name: "image",
            type: "image",
            label: "Image",
            required: false,
            defaultValue: formContent.image,
          },
        ],
      },
      async (data) => {
        setFormContent({ ...formContent, image: data.image });
        await storeCapsuleData(
          context,
          CURRENT_POST_ID,
          JSON.stringify({ ...formContent, image: data.image })
        );
      }
    );

    const removeImage = async () => {
      setFormContent({ ...formContent, image: "" });
      await storeCapsuleData(
        context,
        CURRENT_POST_ID,
        JSON.stringify({ ...formContent, image: "" })
      );
    };

    // Form for guessing
    const guessForm = useForm(
      {
        acceptLabel: "Make the guess!",
        cancelLabel: "Never mind",
        title: "Guess the contents of the time capsule!",
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

        setCurrentUsername(
          (await context.reddit.getCurrentUsername()) as string
        );

        setPage(Pages.BURYING);

        await storeCapsuleData(context, CURRENT_POST_ID, {
          ...formContent,
          buried: true,
        });
      } catch (e) {
        console.error("Error burying capsule:", e);
        setError(e instanceof Error ? e.message : String(e));
        setPage(Pages.ERROR);
      }
    };

    const notifyUser = async () => {
      try {
        const user = await context.reddit.getCurrentUsername();

        if (!user) {
          console.error("Failed to get current user");
          return;
        }

        if (!formContent.revealDate) {
          console.error(
            "Invalid reveal date format : " + formContent.revealDate
          );
          return;
        }

        const revealDate = new Date(formContent.revealDate);
        // Set notification to 1 minute before reveal
        const notificationDate = new Date(revealDate.getTime() - 60 * 1000);

        await context.scheduler.runJob({
          name: "sendNotification",
          data: {
            user,
            author: currentUsername,
            title: formContent.title,
            // Convert to local time for display in notification
            revealDate: convertToLocalTime(formContent.revealDate),
          },
          // Notify user 1 minute before the reveal date
          runAt: notificationDate,
        });
        console.log(
          `Original date : ${formContent.revealDate}
          Local date : ${convertToLocalTime(formContent.revealDate)}
          Notification date : ${notificationDate}`
        );
        context.ui.showToast(
          "You will be notified 1 minute before reveal! at " +
            convertToLocalTime(formContent.revealDate)
        );
      } catch (e) {
        console.error("Error notifying user:", e);
      }
    };

    let content = <></>;

    // navigation
    switch (page) {
      // 0: Main
      case Pages.MAIN:
        content = (
          <>
            <hstack
              width="100%"
              height="100%"
              alignment="top start"
              padding="medium"
            >
              <text size="medium" weight="bold">
                {`<Time Capsule ~ r/${CURRENT_SUBREDDIT_NAME}>`}
              </text>
            </hstack>
            <hstack
              width="100%"
              height="100%"
              alignment="top end"
              padding="medium"
            >
              <icon
                name="help"
                size="large"
                onPress={() => setPage(Pages.ABOUT)}
                color="lightgray"
              />
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
      case Pages.CONFIRM:
        content = (
          <>
            <vstack height="100%" width="100%" padding="medium">
              <vstack width="100%" gap="small" alignment="middle center">
                <hstack width="100%" alignment="middle center">
                  <text size="large" weight="bold" wrap>
                    Confirm your time-capsule's details
                  </text>
                </hstack>
                {/* Content */}
                <vstack width="80%" alignment="middle center">
                  <hstack width="100%">
                    <hstack alignment="middle start">
                      <text size="medium" color="gray">
                        Title:
                      </text>
                      <spacer size="small" />
                      <text size="medium" color="orange" weight="bold" wrap>
                        {formContent.title.substring(0, 25) + "..."}
                      </text>
                    </hstack>
                    <spacer grow />
                    <button
                      appearance="plain"
                      icon="edit"
                      onPress={() => context.ui.showForm(editTitleForm)}
                    />
                  </hstack>
                  {/* <!-- Reveal Date Section --> */}
                  <hstack width="100%">
                    <hstack alignment="middle start">
                      <text size="medium" color="gray">
                        Reveal Date:
                      </text>
                      <spacer size="small" />
                      <text size="medium" color="orange" weight="bold" wrap>
                        {convertToLocalTime(formContent.revealDate)}
                      </text>
                    </hstack>
                    <spacer grow />
                    <button
                      appearance="plain"
                      icon="calendar"
                      onPress={() => setPage(Pages.DATETIME_SELECTOR)}
                    />
                  </hstack>

                  {/* <!-- Theme Section --> */}
                  <hstack width="100%">
                    <hstack alignment="middle start">
                      <text size="medium" color="gray">
                        Theme:
                      </text>
                      <spacer size="small" />
                      <text size="medium" color="orange" weight="bold" wrap>
                        {formContent.theme}
                      </text>
                    </hstack>
                    <spacer grow />
                    <button
                      appearance="plain"
                      icon="edit"
                      onPress={() => context.ui.showForm(editThemeForm)}
                    />
                  </hstack>

                  {/* <!-- Description Section --> */}
                  <hstack width="100%">
                    <hstack alignment="middle start">
                      <text size="medium" color="gray">
                        Description:
                      </text>
                      <spacer size="small" />
                      <text size="medium" color="orange" weight="bold" wrap>
                        {formContent.description.substring(0, 25) + "..."}
                      </text>
                    </hstack>
                    <spacer grow />
                    <button
                      appearance="plain"
                      icon="edit"
                      onPress={() => context.ui.showForm(editDescriptionForm)}
                    />
                  </hstack>
                </vstack>
                {/* Image stuff*/}
                <hstack width="80%" alignment="middle center">
                  <image
                    url={formContent.image || "announcement.jpg"}
                    imageHeight={85}
                    imageWidth={120}
                    resizeMode="cover"
                    onPress={() => setPage(Pages.VIEW_IMAGE)}
                  />
                  <spacer size="small" />
                  <vstack gap="small">
                    <button
                      appearance="secondary"
                      icon="edit"
                      size="small"
                      onPress={() => context.ui.showForm(editImageForm)}
                    />
                    <button
                      appearance="destructive"
                      icon="delete"
                      size="small"
                      onPress={removeImage}
                    />
                  </vstack>
                  <spacer grow />
                  {/* Confirm button */}
                  <hstack alignment="end bottom" padding="large">
                    <button
                      appearance="primary"
                      icon="right"
                      onPress={() => buryCapsule()}
                    >
                      Finalize
                    </button>
                  </hstack>
                </hstack>
              </vstack>
            </vstack>
          </>
        );
        break;
      // 2: Bury capsule
      case Pages.BURYING:
        showBuryingAnimation();
        content = (
          <vstack height="100%" width="100%" alignment="middle center">
            <text size="xlarge">Burying your time capsule....</text>
          </vstack>
        );
        buryingInterval.start();
        break;
      // 3: Success
      case Pages.SUCCESS:
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
              You will be notified 1 minute before the reveal.
            </text>
            <spacer height={20} />
            <button onPress={() => setPage(Pages.TEASER)}>
              See teaser {"->"}
            </button>
          </vstack>
        );
        break;
      // 4: Error
      case Pages.ERROR:
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
      case Pages.ABOUT:
        content = (
          <vstack height="100%" width="100%" alignment="middle center">
            <vstack height="100%" width="60%" alignment="middle center">
              <spacer height={10} />
              <text size="large" wrap alignment="middle center">
                The "Time Capsule" app lets you craft a virtual time capsule
                filled with text and an optional image, staying hidden until
                your chosen reveal date arrives.
              </text>
              <spacer height={5} />
              <text size="large" wrap alignment="middle center">
                How to Use: Start a new time capsule from the subreddit menu.
                Add your title, description, theme, and an optional image.
              </text>
              <spacer height={5} />
              <text size="large" wrap alignment="middle center">
                Confirm and submit your creation.
              </text>
              <text size="large" wrap alignment="middle center">
                Chat with others as the countdown to the reveal begins!
              </text>
              <spacer height={6} />
              <vstack alignment="start top">
                <button onPress={() => setPage(Pages.MAIN)}>Back</button>
              </vstack>
              <spacer height={6} />
            </vstack>
          </vstack>
        );
        break;
      // 5: Teaser
      case Pages.TEASER:
        setRevealBackground();
        content = (
          <vstack
            height="100%"
            width="100%"
            padding="small"
            alignment="middle center"
            gap="small"
          >
            <text size="xlarge" weight="bold" color="white" alignment="center">
              Time Capsule
            </text>
            <text size="small" color="white" alignment="center">
              Buried by u/{currentUsername || "Anonymous"}
            </text>

            <vstack
              backgroundColor="rgba(0, 0, 0, 0.6)"
              padding="small"
              cornerRadius="medium"
              gap="small"
              width="90%"
            >
              <text size="medium" color="white" alignment="center">
                Opening in
              </text>
              <text
                size="large"
                color="orange"
                weight="bold"
                alignment="center"
              >
                {time}
              </text>
              <text size="small" color="white" alignment="center">
                on r/{CURRENT_SUBREDDIT_NAME}
              </text>
            </vstack>

            <hstack width="90%" gap="small" alignment="middle center">
              <vstack
                backgroundColor="rgba(0, 0, 0, 0.6)"
                padding="small"
                cornerRadius="medium"
                grow
                gap="small"
                alignment="middle center"
              >
                <text size="small" color="white" alignment="center">
                  Get notified
                </text>
                <button
                  appearance="primary"
                  icon="notification"
                  size="small"
                  onPress={notifyUser}
                >
                  Remind
                </button>
              </vstack>

              <vstack
                backgroundColor="rgba(0, 0, 0, 0.6)"
                padding="small"
                cornerRadius="medium"
                grow
                gap="small"
                alignment="middle center"
              >
                <text size="small" color="white" alignment="center">
                  What's inside?
                </text>
                <button
                  appearance="secondary"
                  icon="comment"
                  size="small"
                  onPress={() =>
                    context.ui.showForm(guessForm, { title: "Make Your Guess" })
                  }
                >
                  Guess
                </button>
              </vstack>
            </hstack>
          </vstack>
        );
        break;
      // 6: Reveal
      case Pages.REVEAL:
        setRevealBackground();
        const localRevealDate = formContent.revealDate
          ? convertToLocalTime(formContent.revealDate)
          : "soon";

        content = (
          <vstack
            height="100%"
            width="100%"
            padding="small"
            alignment="middle center"
            gap="small"
          >
            <text size="large" weight="bold" color="white" alignment="center">
              Time Capsule Ready
            </text>

            <vstack
              backgroundColor="rgba(0, 0, 0, 0.6)"
              padding="small"
              cornerRadius="medium"
              gap="small"
              width="90%"
            >
              <text size="small" color="white" alignment="center">
                Buried by u/{currentUsername || "Anonymous"}
              </text>
              <text size="small" color="white" alignment="center">
                on {localRevealDate}
              </text>
            </vstack>

            <vstack
              backgroundColor="rgba(0, 0, 0, 0.6)"
              padding="small"
              cornerRadius="medium"
              gap="small"
              width="90%"
              alignment="middle center"
            >
              <text size="medium" color="white" alignment="center">
                The moment has arrived!
              </text>
              <button
                appearance="primary"
                size="medium"
                icon="unlock"
                onPress={() => setPage(Pages.REVEAL_CONTENT)}
              >
                Open Capsule
              </button>
            </vstack>
          </vstack>
        );
        break;
      // 7: Reveal content
      case Pages.REVEAL_CONTENT:
        setRevealBackground();
        const revealedDate = formContent.revealDate
          ? convertToLocalTime(formContent.revealDate)
          : "today";

        content = (
          <vstack
            height="100%"
            width="100%"
            padding="small"
            alignment="middle center"
          >
            <hstack width="100%" alignment="start top">
              <button
                appearance="plain"
                icon="back"
                size="small"
                onPress={() => setPage(Pages.REVEAL)}
              />
            </hstack>

            <vstack
              backgroundColor="rgba(0, 0, 0, 0.6)"
              padding="small"
              cornerRadius="medium"
              gap="small"
              width="90%"
              alignment="middle center"
            >
              <text size="large" weight="bold" color="white" alignment="center">
                {formContent.title || "Time Capsule Contents"}
              </text>

              <vstack
                backgroundColor="rgba(255, 255, 255, 0.1)"
                padding="small"
                cornerRadius="medium"
                width="100%"
              >
                <text size="medium" color="white" alignment="center" wrap>
                  {formContent.description || "No description provided."}
                </text>
              </vstack>

              {formContent.image && (
                <button
                  appearance="primary"
                  icon="image-post"
                  size="small"
                  onPress={() => setPage(Pages.VIEW_IMAGE)}
                >
                  View Image
                </button>
              )}

              <vstack
                backgroundColor="rgba(255, 255, 255, 0.1)"
                padding="small"
                cornerRadius="medium"
                width="100%"
              >
                <text color="lightgray" size="small" alignment="center">
                  By u/{currentUsername || "Anonymous"} • {revealedDate}
                </text>
              </vstack>
            </vstack>
          </vstack>
        );
        break;
      // 8: View image
      case Pages.VIEW_IMAGE:
        content = (
          <zstack height="100%" width="100%" alignment="middle center">
            <hstack alignment="start top" padding="small">
              <icon name="close" onPress={() => setPage(Pages.CONFIRM)} />
            </hstack>
            <image
              url={formContent.image}
              imageHeight={100}
              imageWidth={100}
              width="100%"
              height="100%"
              resizeMode="cover"
              onPress={() =>
                setPage(
                  formContent.buried ? Pages.REVEAL_CONTENT : Pages.CONFIRM
                )
              }
            />
          </zstack>
        );

        break;
      // 9: DateTime Selector
      case Pages.DATETIME_SELECTOR:
        const isDateInPast = () => {
          const now = new Date();
          // Create date in UTC for consistent comparison
          const selectedDate = new Date(
            Date.UTC(
              dateTime.year,
              dateTime.month - 1,
              dateTime.day,
              dateTime.ampm === "PM" && dateTime.hour !== 12
                ? dateTime.hour + 12
                : dateTime.ampm === "AM" && dateTime.hour === 12
                ? 0
                : dateTime.hour,
              dateTime.minute
            )
          );

          return selectedDate.getTime() < now.getTime();
        };

        const updateDateTimeWithValidation = (newDateTime: {
          month?: any;
          day?: any;
          year?: any;
          hour?: any;
          minute?: any;
          ampm?: string;
        }) => {
          const tempDateTime = { ...dateTime, ...newDateTime };
          // Create date in UTC for consistent comparison
          const tempDate = new Date(
            Date.UTC(
              tempDateTime.year,
              tempDateTime.month - 1,
              tempDateTime.day,
              tempDateTime.ampm === "PM" && tempDateTime.hour !== 12
                ? tempDateTime.hour + 12
                : tempDateTime.ampm === "AM" && tempDateTime.hour === 12
                ? 0
                : tempDateTime.hour,
              tempDateTime.minute
            )
          );

          const now = new Date();

          // Only update if the new date is in the future
          if (tempDate.getTime() >= now.getTime()) {
            setDateTime(tempDateTime);
          } else {
            context.ui.showToast("Cannot select a date in the past");
          }
        };

        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        content = (
          <>
            {/* DATE TIME REALTIME UPDATE VIEW */}
            <vstack width="100%" padding="medium" alignment="middle center">
              <hstack width="100%" alignment="middle center" padding="small">
                <text size="xlarge" weight="bold">
                  Set Reveal Date
                </text>
              </hstack>
              <hstack width="100%" alignment="middle center" gap="small">
                <text
                  size="large"
                  weight="bold"
                  color={isDateInPast() ? "red" : "orange"}
                >
                  {`${dateTime.month.toString().padStart(2, "0")}/${dateTime.day
                    .toString()
                    .padStart(2, "0")}/${dateTime.year} ${dateTime.hour
                    .toString()
                    .padStart(2, "0")}:${dateTime.minute
                    .toString()
                    .padStart(2, "0")} `}
                </text>
                <text size="large" weight="bold" color="yellowgreen">
                  {dateTime.ampm + " "}
                </text>
                <text size="large" weight="bold">
                  {timeZone}
                </text>
              </hstack>

              {isDateInPast() && (
                <text color="red" size="small">
                  Please select a future date and time
                </text>
              )}

              <spacer size="medium" />

              {/* DATE AND TIME SELECTORS IN ONE ROW */}
              <hstack width="100%" alignment="middle center" gap="small">
                <vstack alignment="middle center" gap="small">
                  <text weight="bold">Month</text>
                  <button
                    icon="upvote-outline"
                    size="small"
                    onPress={() =>
                      updateDateTimeWithValidation({
                        month: dateTime.month === 12 ? 1 : dateTime.month + 1,
                      })
                    }
                  />
                  <text>{dateTime.month.toString().padStart(2, "0")}</text>
                  <button
                    icon="downvote-outline"
                    size="small"
                    onPress={() =>
                      updateDateTimeWithValidation({
                        month: dateTime.month === 1 ? 12 : dateTime.month - 1,
                      })
                    }
                  />
                </vstack>

                <vstack alignment="middle center" gap="small">
                  <text weight="bold">Day</text>
                  <button
                    icon="upvote-outline"
                    size="small"
                    onPress={() =>
                      updateDateTimeWithValidation({
                        day: dateTime.day === 31 ? 1 : dateTime.day + 1,
                      })
                    }
                  />
                  <text>{dateTime.day.toString().padStart(2, "0")}</text>
                  <button
                    icon="downvote-outline"
                    size="small"
                    onPress={() =>
                      updateDateTimeWithValidation({
                        day: dateTime.day === 1 ? 31 : dateTime.day - 1,
                      })
                    }
                  />
                </vstack>

                <vstack alignment="middle center" gap="small">
                  <text weight="bold">Year</text>
                  <button
                    icon="upvote-outline"
                    size="small"
                    onPress={() =>
                      updateDateTimeWithValidation({
                        year: dateTime.year + 1,
                      })
                    }
                  />
                  <text>{dateTime.year}</text>
                  <button
                    icon="downvote-outline"
                    size="small"
                    onPress={() =>
                      updateDateTimeWithValidation({
                        year: dateTime.year - 1,
                      })
                    }
                  />
                </vstack>

                <spacer size="small" />

                <vstack alignment="middle center" gap="small">
                  <text weight="bold">Hour</text>
                  <button
                    icon="upvote-outline"
                    size="small"
                    onPress={() =>
                      updateDateTimeWithValidation({
                        hour: dateTime.hour === 12 ? 1 : dateTime.hour + 1,
                      })
                    }
                  />
                  <text>{dateTime.hour.toString().padStart(2, "0")}</text>
                  <button
                    icon="downvote-outline"
                    size="small"
                    onPress={() =>
                      updateDateTimeWithValidation({
                        hour: dateTime.hour === 1 ? 12 : dateTime.hour - 1,
                      })
                    }
                  />
                </vstack>

                <vstack alignment="middle center" gap="small">
                  <text weight="bold">Minute</text>
                  <button
                    icon="upvote-outline"
                    size="small"
                    onPress={() =>
                      updateDateTimeWithValidation({
                        minute:
                          dateTime.minute === 59 ? 0 : dateTime.minute + 1,
                      })
                    }
                  />
                  <text>{dateTime.minute.toString().padStart(2, "0")}</text>
                  <button
                    icon="downvote-outline"
                    size="small"
                    onPress={() =>
                      updateDateTimeWithValidation({
                        minute:
                          dateTime.minute === 0 ? 59 : dateTime.minute - 1,
                      })
                    }
                  />
                </vstack>

                <vstack alignment="middle center" gap="small">
                  <text weight="bold">AM/PM</text>
                  <button
                    icon="upvote-outline"
                    size="small"
                    onPress={() =>
                      updateDateTimeWithValidation({
                        ampm: dateTime.ampm === "AM" ? "PM" : "AM",
                      })
                    }
                  />
                  <text>{dateTime.ampm}</text>
                  <button
                    icon="downvote-outline"
                    size="small"
                    onPress={() =>
                      updateDateTimeWithValidation({
                        ampm: dateTime.ampm === "AM" ? "PM" : "AM",
                      })
                    }
                  />
                </vstack>
              </hstack>

              {/* BUTTONS */}
              <hstack
                width="100%"
                alignment="middle center"
                gap="medium"
                padding="medium"
              >
                <button
                  appearance="secondary"
                  icon="back"
                  onPress={() => {
                    const revealDate = new Date(
                      Date.UTC(
                        dateTime.year,
                        dateTime.month - 1,
                        dateTime.day,
                        dateTime.ampm === "PM" && dateTime.hour !== 12
                          ? dateTime.hour + 12
                          : dateTime.ampm === "AM" && dateTime.hour === 12
                          ? 0
                          : dateTime.hour,
                        dateTime.minute
                      )
                    );

                    // Update form content with the selected date
                    setFormContent({
                      ...formContent,
                      revealDate: revealDate.toISOString(),
                    });

                    // Store the updated data
                    storeCapsuleData(
                      context,
                      CURRENT_POST_ID,
                      JSON.stringify({
                        ...formContent,
                        revealDate: revealDate.toISOString(),
                      })
                    );

                    // Now navigate to confirm page
                    setPage(Pages.CONFIRM);
                  }}
                >
                  Back
                </button>
                <button
                  appearance="primary"
                  icon="checkmark"
                  disabled={isDateInPast()}
                  onPress={() => {
                    if (!isDateInPast()) {
                      updateRevealDate(
                        `${dateTime.month
                          .toString()
                          .padStart(2, "0")}/${dateTime.day
                          .toString()
                          .padStart(2, "0")}/${dateTime.year} ${dateTime.hour
                          .toString()
                          .padStart(2, "0")}:${dateTime.minute
                          .toString()
                          .padStart(2, "0")} ${dateTime.ampm}`
                      );
                      setPage(Pages.CONFIRM);
                    } else {
                      context.ui.showToast(
                        "Please select a future date and time"
                      );
                    }
                  }}
                >
                  Confirm
                </button>
              </hstack>
            </vstack>
          </>
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
