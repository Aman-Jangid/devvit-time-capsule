import { Devvit, useForm, useInterval, useState } from "@devvit/public-api";

import { CAPSULE_THEMES } from "./constants.js";

import { retrieveCapsuleData, storeCapsuleData } from "./server/redis.js";

import {
  compareDates,
  countdown,
  formatDate,
  getCurrentDate,
  getCurrentTime,
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
      ui.showToast("An error occurred while creating the time capsule.");
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
        text: `You can now see the contents of the Time-Capsule "${title}" by ${author} buried in r/${subredditName} set to be revealed on ${revealDate}.`,
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
      title: "dummy title",
      description: "dummy description",
      revealDate: "12/12/2025 12:00 AM",
      image: "https://i.redd.it/vec1541jowqe1.jpeg" as any,
      theme: CAPSULE_THEMES[0],
    };

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

    // State
    const [page, setPage] = useState<number>(Pages.MAIN);
    const [backgroundUrl, setBackgroundUrl] =
      useState<string>("background.jpg");
    const [error, setError] = useState<string>("");
    const [currentUsername, setCurrentUsername] = useState<string>("");
    const [time, setTime] = useState<string>("");
    // paginate text content if it doesn't fit in the page
    const [textContentPage, setTextContentPage] = useState<number>(0);
    const [formContent, setFormContent] = useState(async () => {
      try {
        const data = await retrieveCapsuleData(context, CURRENT_POST_ID);
        if (!data) return DEFAULT_FORM_CONTENT;
        if (data.buried) {
          if (compareDates(formatDate(data.revealDate), new Date()) < 0)
            setPage(Pages.REVEAL);
          else setPage(Pages.TEASER);
        }
        return data;
      } catch (e) {
        console.error("Error getting post data:", e);
        return DEFAULT_FORM_CONTENT;
      }
    });
    // datetime
    const [dateTime, setDateTime] = useState({
      month: 0,
      day: 0,
      year: 0,
      hour: 0,
      minute: 0,
      ampm: "AM",
    });

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

    const updateRevealDate = async (revealDate: any) => {
      setFormContent({ ...formContent, revealDate: revealDate });
      await storeCapsuleData(
        context,
        CURRENT_POST_ID,
        JSON.stringify({ ...formContent, revealDate: revealDate })
      );
    };

    // Intervals
    const buryingInterval = useInterval(() => {
      setPage(Pages.SUCCESS);
      setMainBackground();
      buryingInterval.stop();
    }, 3500);

    useInterval(() => {
      // if (time === "00d 00h 00m 00s") {
      //   setPage(Pages.REVEAL);
      //   setRevealBackground();
      //   return;
      // }
      setTime(countdown(formContent.revealDate));
    }, 1000).start();

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
          setPage(Pages.ERROR);
          return;
        }

        setPage(Pages.CONFIRM);
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

    const editRevealDateForm = useForm(
      {
        acceptLabel: "Save",
        cancelLabel: "Cancel",
        title: "Edit Reveal Date",
        fields: [
          {
            name: "revealDate",
            type: "string",
            label: "Reveal Date",
            required: true,
            defaultValue: formContent.revealDate,
          },
        ],
      },
      async (data) => {
        await updateRevealDate(data.revealDate);
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

        const formattedRevealDate = formatDate(formContent.revealDate);

        setCurrentUsername(
          (await context.reddit.getCurrentUsername()) as string
        );

        setPage(Pages.BURYING);
        storeCapsuleData(context, CURRENT_POST_ID, {
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
        const notificationDate = new Date(revealDate.getTime() + 1000);

        await context.scheduler.runJob({
          name: "sendNotification",
          data: {
            user,
            author: currentUsername,
            title: formContent.title,
            // TODO : show date in viewers's timezone
            revealDate: revealDate.toUTCString(),
          },
          // Notify user 1 second after the reveal date
          runAt: notificationDate,
        });
        context.ui.showToast("You will be notified 1 minute before reveal.");
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
                        {formContent.revealDate}
                      </text>
                    </hstack>
                    <spacer grow />
                    <button
                      appearance="plain"
                      icon="edit"
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
                The "Reddit Time Capsule" app lets you craft a virtual time
                capsule filled with text and an optional image, staying hidden
                until your chosen reveal date arrives.
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
        // set background based on the theme
        setBackgroundUrl(formContent.theme[0].toLowerCase() + ".jpg");

        content = (
          <vstack height="100%" width="100%" alignment="middle center">
            <text size="xxlarge">Teaser</text>
            <text size="xlarge">Time capsule buried by {currentUsername}</text>
            <spacer height={10} />
            <text size="xlarge">
              {`Will be revealed on the subreddit ${CURRENT_SUBREDDIT_NAME} in ${time}`}
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
      // 6: Reveal
      case Pages.REVEAL:
        content = (
          <vstack height="100%" width="100%" alignment="middle center">
            <text size="xxlarge">Time Capsule Reveal</text>
            <spacer height={10} />
            <text size="xlarge">
              The time capsule was buried by {currentUsername} and will be
              revealed on {formContent.revealDate}
            </text>
            <spacer height={10} />
            <text size="xlarge" wrap>
              Press the button below to reveal the contents of the time capsule.
            </text>
            <spacer size="small" />
            <button onPress={() => setPage(Pages.REVEAL_CONTENT)}>
              Reveal
            </button>
            <spacer height={10} />
          </vstack>
        );
        break;
      // 7: Reveal Content
      case Pages.REVEAL_CONTENT:
        content = (
          <vstack height="100%" width="100%" alignment="middle center">
            <hstack alignment="start top" padding="small">
              <icon name="close" onPress={() => setPage(Pages.REVEAL)} />
            </hstack>
            <vstack width="100%" alignment="middle center">
              <text size="xxlarge">{formContent.title}</text>
              <spacer height={10} />
              <text size="xlarge">{formContent.description}</text>
              <spacer height={10} />
              <text size="xlarge">
                Revealed by {currentUsername} on {getCurrentTime()}
              </text>
              <spacer height={10} />
              {formContent.image && (
                <button onPress={() => setPage(Pages.VIEW_IMAGE)}>
                  See Image
                </button>
              )}
            </vstack>
          </vstack>
        );
        break;
      // 8: View Image
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
        content = (
          // grid of 3 cols 2 rows with input and up down arrows above and below each item to change the date and time
          <>
            {/* DATE TIME REALTIME UPDATE VIEW */}
            <vstack width="100%" padding="medium" alignment="middle center">
              <hstack width="100%" alignment="middle center" padding="small">
                <text size="xlarge" weight="bold">
                  Set Reveal Date
                </text>
              </hstack>
              <hstack width="100%" alignment="middle center">
                <text size="large" weight="bold" color="orange">
                  {`${dateTime.month.toString().padStart(2, "0")}/${dateTime.day
                    .toString()
                    .padStart(2, "0")}/${dateTime.year} ${dateTime.hour
                    .toString()
                    .padStart(2, "0")}:${dateTime.minute
                    .toString()
                    .padStart(2, "0")}`}{" "}
                </text>
                <text size="large" weight="bold" color="yellowgreen">
                  {dateTime.ampm}
                </text>
                <text size="large" weight="bold">
                  UTC
                </text>
              </hstack>

              <spacer size="medium" />

              {/* DATE AND TIME SELECTORS IN ONE ROW */}
              <hstack width="100%" alignment="middle center" gap="small">
                <vstack alignment="middle center" gap="small">
                  <text weight="bold">Month</text>
                  <button
                    icon="upvote-outline"
                    size="small"
                    onPress={() =>
                      setDateTime({
                        ...dateTime,
                        month: dateTime.month === 12 ? 1 : dateTime.month + 1,
                      })
                    }
                  />
                  <text>{dateTime.month.toString().padStart(2, "0")}</text>
                  <button
                    icon="downvote-outline"
                    size="small"
                    onPress={() =>
                      setDateTime({
                        ...dateTime,
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
                      setDateTime({
                        ...dateTime,
                        day: dateTime.day === 31 ? 1 : dateTime.day + 1,
                      })
                    }
                  />
                  <text>{dateTime.day.toString().padStart(2, "0")}</text>
                  <button
                    icon="downvote-outline"
                    size="small"
                    onPress={() =>
                      setDateTime({
                        ...dateTime,
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
                      setDateTime({
                        ...dateTime,
                        year: dateTime.year + 1,
                      })
                    }
                  />
                  <text>{dateTime.year}</text>
                  <button
                    icon="downvote-outline"
                    size="small"
                    onPress={() =>
                      setDateTime({
                        ...dateTime,
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
                      setDateTime({
                        ...dateTime,
                        hour: dateTime.hour === 12 ? 1 : dateTime.hour + 1,
                      })
                    }
                  />
                  <text>{dateTime.hour.toString().padStart(2, "0")}</text>
                  <button
                    icon="downvote-outline"
                    size="small"
                    onPress={() =>
                      setDateTime({
                        ...dateTime,
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
                      setDateTime({
                        ...dateTime,
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
                      setDateTime({
                        ...dateTime,
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
                      setDateTime({
                        ...dateTime,
                        ampm: dateTime.ampm === "AM" ? "PM" : "AM",
                      })
                    }
                  />
                  <text>{dateTime.ampm}</text>
                  <button
                    icon="downvote-outline"
                    size="small"
                    onPress={() =>
                      setDateTime({
                        ...dateTime,
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
                  onPress={() => setPage(Pages.CONFIRM)}
                >
                  Back
                </button>
                <button
                  appearance="primary"
                  icon="checkmark"
                  onPress={() => {
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
