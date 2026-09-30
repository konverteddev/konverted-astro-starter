import { LaunchIcon } from "@sanity/icons/Launch";
import { MasterDetailIcon } from "@sanity/icons/MasterDetail";
import { PresentationIcon } from "@sanity/icons/Presentation";
import { enablePreviewAccessSharing } from "@sanity/preview-url-secret/toggle-preview-access-sharing";
import type { DocumentActionComponent, DocumentActionsContext } from "sanity";
import { getPublishedId } from "sanity";
import { useRouter } from "sanity/router";
import { sanityConfig } from "./config";
import { AGENT_SCRATCH_DOCUMENTS, API_ONLY_DOCUMENTS, SINGLETON_IDS } from "./constants";

function createOpenPublishedPageAction(_: DocumentActionsContext) {
  const openPublishedPageAction: DocumentActionComponent = (props) => {
    const uri = (props.published as { uri?: { current?: string } } | undefined)?.uri?.current;

    if (!uri) {
      return null;
    }

    const url = new URL(`${sanityConfig.appUrl}${sanityConfig.endpoints.draftModeDisable}`);
    url.searchParams.set("redirectTo", uri);

    return {
      label: "Open live page",
      icon: LaunchIcon,
      onHandle: () => {
        window.open(url.toString(), "_blank", "noreferrer");
      },
    };
  };

  return openPublishedPageAction;
}

function createOpenPreviewPageAction({ getClient, currentUser }: DocumentActionsContext) {
  const client = getClient({ apiVersion: sanityConfig.apiVersion });

  const openPreviewPageAction: DocumentActionComponent = (props) => {
    const draftUri = (props.draft as { uri?: { current?: string } } | undefined)?.uri?.current;
    const publishedUri = (props.published as { uri?: { current?: string } } | undefined)?.uri?.current;
    const uri = draftUri ?? publishedUri;

    if (!uri) {
      return null;
    }

    return {
      label: "Open draft page",
      icon: LaunchIcon,
      onHandle: async () => {
        try {
          const { secret } = await enablePreviewAccessSharing(client, "", "", currentUser?.id);
          const url = new URL(`${sanityConfig.appUrl}${sanityConfig.endpoints.draftModeEnable}`);
          url.searchParams.set("sanity-preview-secret", secret);
          url.searchParams.set("sanity-preview-pathname", uri);
          url.searchParams.set("sanity-preview-perspective", "drafts");
          window.open(url.toString(), "_blank", "noreferrer");
        } catch (e) {
          console.error("Failed to open preview page:", e);
          alert("Failed to open preview page. See console for details.");
        }
      },
    };
  };

  return openPreviewPageAction;
}

function createOpenPresentationAction(_: DocumentActionsContext) {
  const openPresentationAction: DocumentActionComponent = (props) => {
    const { navigateIntent } = useRouter();
    const draftUri = (props.draft as { uri?: { current?: string } } | undefined)?.uri?.current;
    const publishedUri = (props.published as { uri?: { current?: string } } | undefined)?.uri?.current;
    const uri = draftUri ?? publishedUri;

    if (!uri) {
      return null;
    }

    const documentId = getPublishedId(props.id);
    const documentType = props.type;
    const basePath = sanityConfig.studioBasePath.replace(/\/$/, "");
    const isPresentationMode = typeof window !== "undefined" && window.location.pathname.startsWith(`${basePath}/presentation`);

    if (!documentId || !documentType || isPresentationMode) {
      return null;
    }

    return {
      label: "Open in presentation",
      icon: PresentationIcon,
      onHandle: () => {
        navigateIntent("edit", {
          id: documentId,
          type: documentType,
          mode: "presentation",
          presentation: "presentation",
          preview: uri,
        });
      },
    };
  };

  return openPresentationAction;
}

function createOpenStructureAction(_: DocumentActionsContext) {
  const openStructureAction: DocumentActionComponent = (props) => {
    const { navigateIntent } = useRouter();
    const documentId = getPublishedId(props.id);
    const documentType = props.type;
    const basePath = sanityConfig.studioBasePath.replace(/\/$/, "");
    const isPresentationMode = typeof window !== "undefined" && window.location.pathname.startsWith(`${basePath}/presentation`);

    if (!documentId || !documentType || !isPresentationMode) {
      return null;
    }

    return {
      label: "Open in Structure",
      icon: MasterDetailIcon,
      onHandle: () => {
        navigateIntent("edit", {
          id: documentId,
          type: documentType,
          mode: "structure",
        });
      },
    };
  };

  return openStructureAction;
}

const singletonIds: string[] = Object.values(SINGLETON_IDS);
const apiOnlyTypes: string[] = Object.values(API_ONLY_DOCUMENTS);
const scratchTypes: string[] = Object.values(AGENT_SCRATCH_DOCUMENTS);

export function createDocumentActions(prev: DocumentActionComponent[], ctx: DocumentActionsContext) {
  const { schemaType, documentId } = ctx;

  if (!schemaType || !documentId) {
    return prev;
  }

  let builtInActions = prev;

  if (singletonIds.includes(schemaType) || singletonIds.includes(documentId)) {
    builtInActions = prev.filter(({ action }) => {
      return action && ["publish", "discardChanges", "restore"].includes(action);
    });
  }

  if (apiOnlyTypes.includes(schemaType) || apiOnlyTypes.includes(documentId)) {
    builtInActions = prev.filter(({ action }) => {
      return action && ["delete", "discardChanges"].includes(action);
    });
  }

  if (scratchTypes.includes(schemaType) || scratchTypes.includes(documentId)) {
    builtInActions = prev.filter(({ action }) => {
      return action && ["delete", "discardChanges"].includes(action);
    });
  }

  const openStructureAction = createOpenStructureAction(ctx);
  const openPreviewPageAction = createOpenPreviewPageAction(ctx);
  const openPresentationAction = createOpenPresentationAction(ctx);
  const openPublishedPageAction = createOpenPublishedPageAction(ctx);
  const customActions = [openPublishedPageAction, openPreviewPageAction, openPresentationAction, openStructureAction];

  return [...builtInActions, ...customActions] as const satisfies DocumentActionComponent[];
}
