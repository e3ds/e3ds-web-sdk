/**
 * Types for @eagle3dstreaming/web-sdk.
 * Reference for every call and callback: https://learn.eagle3dstreaming.com/wiki/javascript-sdk-guide
 */

/** What a call answers when it refuses its input. */
export interface E3dsResult {
    ok: boolean;
    error?: string;
    message?: string;
    [key: string]: unknown;
}

/** The functions the SDK calls on your page. Every one is optional. */
export interface E3dsCallbacks {
    /** The configuration arrived from the platform; the video is not playing yet. */
    onConfigAcquire?: () => void;
    /** Downloading the app onto the streaming machine (skipped when it is already there). 0-100. */
    onReceivingAppAcquiringProgress?: (percent: string) => void;
    /** Unpacking / preparing the app (may be skipped). 0-100. */
    onReceivingAppPreparationProgress?: (percent: string) => void;
    /** Launching the app. 0-100. */
    onReceivingAppStartingProgress?: (percent: string) => void;
    /** The stream is live and messages to the app can be sent. Build your controls here. */
    onDataChannelOpen?: () => void;
    /** The data channel closed; no more messages can be exchanged. */
    onDataChannelClose?: () => void;
    /** Your Unreal application sent something to the page. */
    onResponseFromUnreal?: (descriptor: string) => void;
    /** The session is ending, for any reason. `message` is text meant for a person. */
    onSessionEnding?: (message?: string) => void;
    /** The session's time ran out. */
    onSessionExpired?: () => void;
    /** The streaming app stopped running. */
    onStreamerDisconnected?: () => void;
    /** Every lifecycle event, as one object with a `type` (e.g. "session.queued", "stream.playing"). */
    onEvent?: (event: { type: string; [key: string]: unknown }) => void;
    /** Connection statistics, at the interval set with setConnectionStatsInterval(). */
    onConnectionStats?: (stats: Record<string, unknown>) => void;
    /** The stream gained / lost keyboard focus. */
    onStreamFocusGained?: () => void;
    onStreamFocusLost?: () => void;
    [name: string]: ((...args: any[]) => void) | undefined;
}

/** What a session token request returns. Pass it to startStream() / main() unchanged. */
export interface SessionTokenData {
    token: string;
    socket_url: string;
    [key: string]: unknown;
}

/** window.e3ds_controller - the SDK's own API. */
export interface E3dsController {
    callbacks: E3dsCallbacks;
    /** Start a session. Expects the token data plus the user name the token was created for. */
    main(tokenData: SessionTokenData & { client?: string; userName?: string }): E3dsResult | void;
    /** End the session and release the machine. */
    terminate(message?: string): void;
    /** Send your own data to the Unreal application (Pixel Streaming emitUIInteraction). */
    sendMessageToStreamingBuild(data: string | object): void;
    /** Pixel Streaming plugin command channel (resolution, encoder...); does not reach your app's handler. */
    sendCommandToUE(command: object): void;
    /** Run an Unreal console command, e.g. "stat fps". */
    sendConsoleCommandToUE(command: string): void;
    /** Pin the stream to a fixed resolution. */
    setResolution(width: number, height: number): E3dsResult;
    /** Let the stream follow the size of the page again. */
    useViewportResolution(): E3dsResult;
    /** "low" | "medium" | "high" | "ultra". */
    setVideoDetailLevel(level: "low" | "medium" | "high" | "ultra" | string): E3dsResult | void;
    /** Encoder quantisation (lower is better quality). */
    setQualityPoint(qp: number): void;
    /** Encoder min/max quantisation. */
    setAdaptiveQualityPoint(minQP: number, maxQP: number): void;
    /** "HoveringMouse" | "LockedMouse". */
    switchMouseControlSchemeTo(scheme: string): void;
    setTouchInputEnabled(enabled: boolean): void;
    /** 0..1. */
    setVolume(volume: number): boolean | E3dsResult;
    toggleFullscreen(): void;
    /** Save the current frame as a PNG. */
    captureScreenShot(): E3dsResult | void;
    captureScreenshot(): E3dsResult | void;
    /** Seconds between onConnectionStats calls. */
    setConnectionStatsInterval(seconds: number): E3dsResult | void;
    [name: string]: unknown;
}

export interface LoadOptions {
    /** Load the SDK from this address instead of the copy in this package. */
    src?: string;
    /** Give up on one address after this long. Default 30000. */
    timeoutMs?: number;
    /** Try CDN_URL when the bundled copy cannot be loaded. Default true. */
    cdnFallback?: boolean;
}

export interface ApplicationTarget {
    /** The connector your account was issued, e.g. "connector.eagle3dstreaming.com". */
    domain: string;
    /** The account that owns the app. */
    userName: string;
    /** The app's name exactly as the Control Panel shows it. */
    appName: string;
    /** The stored configuration to launch. */
    configurationName: string;
    /** A version, or "latest" (default). */
    version?: string;
}

export interface CreateSessionTokenOptions {
    /** Your Streaming API key. Keep it on your server for any public page. */
    apiKey: string;
    application: ApplicationTarget;
    /** Per-session overrides of the stored configuration. */
    configurationToOverride?: Record<string, unknown>;
    /** How long the token stays valid, ms. Default 60000. */
    expiryMs?: number;
    /** Token endpoint. Default TOKEN_ENDPOINT. */
    endpoint?: string;
    /** A fetch implementation, for runtimes without a global fetch. */
    fetch?: typeof fetch;
}

export interface StartStreamOptions extends LoadOptions {
    /** The user name the token was created for (application.userName). */
    userName?: string;
}

export declare const PACKAGE_NAME: string;
export declare const VERSION: string;
export declare const SDK_FILE: string;
export declare const TOKEN_ENDPOINT: string;
export declare const CDN_URL: string;
export declare const PLAYER_ELEMENT_ID: "playerUI";

/** Load the SDK into the page (once). Resolves to window.e3ds_controller. Browser only. */
export declare function loadE3dsSdk(options?: LoadOptions): Promise<E3dsController>;
/** window.e3ds_controller once loaded, otherwise undefined. */
export declare function getController(): E3dsController | undefined;
/** Exchange a Streaming API key for a session token. Server (Node 18+) or browser. */
export declare function createSessionToken(options: CreateSessionTokenOptions): Promise<SessionTokenData>;
/** Load the SDK if needed and start a session with the token. */
export declare function startStream(tokenData: SessionTokenData, options?: StartStreamOptions): Promise<E3dsResult | void>;

declare const _default: {
    loadE3dsSdk: typeof loadE3dsSdk;
    createSessionToken: typeof createSessionToken;
    startStream: typeof startStream;
    getController: typeof getController;
    VERSION: string;
    CDN_URL: string;
    TOKEN_ENDPOINT: string;
    SDK_FILE: string;
    PACKAGE_NAME: string;
    PLAYER_ELEMENT_ID: "playerUI";
};
export default _default;

declare global {
    interface Window {
        e3ds_controller?: E3dsController;
    }
}
