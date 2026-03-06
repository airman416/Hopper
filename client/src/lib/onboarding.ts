import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { db } from "./db";
import { useHopperStore } from "./store";
import { toast } from "@/hooks/use-toast";

const ONBOARDING_KEY = "onboarding_complete";
let selectPostStepUnsub: (() => void) | null = null;
let instagramTabStepUnsub: (() => void) | null = null;

export async function getOnboardingComplete(): Promise<boolean> {
  try {
    const row = await db.app_settings.get(ONBOARDING_KEY);
    return row?.value === true;
  } catch {
    return false;
  }
}

export async function setOnboardingComplete(complete: boolean): Promise<void> {
  await db.app_settings.put({ key: ONBOARDING_KEY, value: complete });
}

export function startOnboarding(options?: {
  onRefresh?: () => void;
  onComplete?: () => void;
}): void {
  const store = useHopperStore.getState();
  store.setOnboardingDidRefresh(false);
  store.setOnboardingPlatformExpanded(false);
  store.setOnboardingDidExport(false);

  const steps: DriveStep[] = [
    {
      element: () => null,
      popover: {
        title: "Welcome to Content Engine!",
        description:
          "Let's take a quick tour. You'll learn how to load posts, convert them to Instagram format, and download your images.",
        side: "over",
        align: "center",
        popoverClass: "driver-popover-centered",
      },
    },
    {
      element: "[data-onboarding-refresh]",
      popover: {
        title: "Load your posts",
        description:
          "Click the refresh button to load posts from your connected accounts (X, LinkedIn, Instagram).",
        side: "bottom",
        align: "center",
        onNextClick: (_el, _step, opts) => {
          const { sourcePosts, onboardingDidRefresh } = useHopperStore.getState();
          if (sourcePosts.length > 0 || onboardingDidRefresh) {
            opts.driver.moveNext();
          } else {
            toast({ title: "Please click the refresh button first", variant: "destructive" });
          }
        },
      },
      disableActiveInteraction: false,
    },
    {
      element: "[data-onboarding-posts]",
      popover: {
        title: "Select a post",
        description:
          "First expand a platform (e.g. X or LinkedIn) by clicking it, then click on a post to select it.",
        side: "right",
        align: "start",
        disableButtons: ["next"],
        onNextClick: (_el, _step, opts) => {
          const { onboardingPlatformExpanded, selectedPostIndex } = useHopperStore.getState();
          if (onboardingPlatformExpanded && selectedPostIndex >= 0) {
            opts.driver.moveNext();
          } else if (!onboardingPlatformExpanded) {
            toast({ title: "Please expand a platform first by clicking it", variant: "destructive" });
          } else {
            toast({ title: "Please select a post", variant: "destructive" });
          }
        },
        onPopoverRender: (popover, opts) => {
          const SELECT_POST_STEP_INDEX = 2;
          const updateNextButton = () => {
            if (opts.driver.getActiveIndex() !== SELECT_POST_STEP_INDEX) return;
            const { onboardingPlatformExpanded, selectedPostIndex } = useHopperStore.getState();
            const nextBtn = popover.nextButton;
            if (!nextBtn) return;
            const canAdvance = onboardingPlatformExpanded && selectedPostIndex >= 0;
            nextBtn.disabled = !canAdvance;
            nextBtn.classList.toggle("driver-popover-btn-disabled", !canAdvance);
          };
          updateNextButton();
          selectPostStepUnsub = useHopperStore.subscribe(updateNextButton);
        },
      },
      onDeselected: () => {
        selectPostStepUnsub?.();
        selectPostStepUnsub = null;
      },
    },
    {
      element: "[data-onboarding-tab-instagram]",
      popover: {
        title: "Switch to Instagram",
        description:
          "Click the IG Carousel tab to convert your post into an Instagram-ready format.",
        side: "bottom",
        align: "center",
        disableButtons: ["next"],
        onNextClick: (_el, _step, opts) => {
          const { activeTab } = useHopperStore.getState();
          if (activeTab === "instagram") {
            opts.driver.moveNext();
          } else {
            toast({ title: "Please switch to the IG Carousel tab first", variant: "destructive" });
          }
        },
        onPopoverRender: (popover, opts) => {
          const INSTAGRAM_TAB_STEP_INDEX = 3;
          const updateNextButton = () => {
            if (opts.driver.getActiveIndex() !== INSTAGRAM_TAB_STEP_INDEX) return;
            const { activeTab } = useHopperStore.getState();
            const nextBtn = popover.nextButton;
            if (!nextBtn) return;
            const canAdvance = activeTab === "instagram";
            nextBtn.disabled = !canAdvance;
            nextBtn.classList.toggle("driver-popover-btn-disabled", !canAdvance);
          };
          updateNextButton();
          instagramTabStepUnsub = useHopperStore.subscribe(updateNextButton);
        },
      },
      onDeselected: () => {
        instagramTabStepUnsub?.();
        instagramTabStepUnsub = null;
      },
    },
    {
      element: "[data-onboarding-generate]",
      popover: {
        title: "Generate content",
        description:
          "Click Generate to create an Instagram version of your post. The AI will adapt the content for the platform.",
        side: "bottom",
        align: "center",
        onNextClick: (_el, _step, opts) => {
          const { drafts, sourcePosts, selectedPostIndex, activeTab } = useHopperStore.getState();
          const selectedPost = sourcePosts[selectedPostIndex];
          const hasInstagramDraft = drafts.some(
            (d) =>
              d.platform === "instagram" &&
              d.sourcePostId === selectedPost?.id &&
              (d.status === "draft" || d.status === "approved"),
          );
          if (activeTab === "instagram" && hasInstagramDraft) {
            opts.driver.moveNext();
          } else {
            toast({ title: "Please click Generate to create an Instagram version first", variant: "destructive" });
          }
        },
      },
    },
    {
      element: "[data-onboarding-fk-score]",
      popover: {
        title: "F-K Score",
        description:
          "Flesch-Kincaid grade level — lower = easier to read.<br><br>Target: 7 or below (8th grade).<br><br>Green = easy<br>Amber = moderate<br>Red = hard",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-onboarding-approve-reject]",
      popover: {
        title: "Approve or Reject",
        description:
          "Your feedback trains the model on what you like. Approve drafts you'd use; reject ones you wouldn't. The AI learns from both.",
        side: "top",
        align: "center",
      },
    },
    {
      element: "[data-onboarding-dim-square]",
      popover: {
        title: "Change format to Square",
        description:
          "Switch from Portrait to Square for the best Instagram feed layout. Click the Square button.",
        side: "bottom",
        align: "center",
        onNextClick: (_el, _step, opts) => {
          const { assetDimension } = useHopperStore.getState();
          if (assetDimension === "1080x1080") {
            opts.driver.moveNext();
          } else {
            toast({ title: "Please click the Square button to change the format first", variant: "destructive" });
          }
        },
      },
    },
    {
      element: "[data-onboarding-export]",
      popover: {
        title: "Download your image",
        description:
          "Click Export to download your Instagram-ready image. You can also use ⌘↵ (Cmd+Enter) as a shortcut.",
        side: "bottom",
        align: "center",
        onNextClick: (_el, _step, opts) => {
          const { onboardingDidExport } = useHopperStore.getState();
          if (onboardingDidExport) {
            opts.driver.moveNext();
          } else {
            toast({ title: "Please click Export to download your image first", variant: "destructive" });
          }
        },
      },
    },
    {
      element: "[data-onboarding-formats]",
      popover: {
        title: "Try other formats",
        description:
          "LinkedIn (L), X (X), Newsletter (N), Quote (Q) — switch tabs to adapt your draft for different platforms. If you click the same platform as the original, you get an exportable image version with no changes.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-onboarding-what-else]",
      popover: {
        title: "Refine & export",
        description:
          "Punchier (P), Hater (H) to generate a cynical opposing reply, or Shaan (S) to see what it would sound like if Shaan Puri wrote it. <br><br>Shortcuts: G Generate, A Approve, R Reject, ⌘↵ Export.",
        side: "top",
        align: "center",
      },
    },
    {
      element: () => null,
      popover: {
        title: "You're all set!",
        description:
          "Go repurpose some content. Wishing you all the best!",
        side: "over",
        align: "center",
        popoverClass: "driver-popover-centered",
      },
    },
  ];

  const driverObj = driver({
    showProgress: true,
    progressText: "{{current}} of {{total}}",
    steps,
    overlayColor: "#1C2B22",
    overlayOpacity: 0.82,
    stagePadding: 12,
    stageRadius: 8,
    allowClose: true,
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    onHighlightStarted: (_element, _step, opts) => {
      // In incognito, fonts/resources load slower (no cache), so layout may not be ready
      // when driver.js first calculates the overlay. Refresh after layout settles.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          opts.driver.refresh();
        });
      });
    },
    onDestroyed: async () => {
      await setOnboardingComplete(true);
      options?.onComplete?.();
    },
  });

  driverObj.drive();
}
