import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { App } from "@modelcontextprotocol/ext-apps";
import { UI_META_KEY } from "../../types/ui-props.js";

export interface AppHandle<P> {
  app: App;
  props: P;
  /** Subscribe to host-pushed tool-result notifications (re-invoke from chat). */
  onUpdate(handler: (props: P) => void): void;
}

/**
 * Pull the `_meta["modelcontextprotocol.io/ui"].props` payload off a tool
 * result. Used by iframes that initiate their own callServerTool — those
 * resolve via the request promise, not the toolresult event.
 */
export function extractUiProps<P>(result: CallToolResult): P | undefined {
  const meta = (result as { _meta?: Record<string, unknown> })._meta;
  const ui = meta?.[UI_META_KEY] as { props?: P } | undefined;
  return ui?.props;
}

/**
 * Connect to the host, wait for the initial tool-result, and return its props.
 *
 * Per the SDK warning, event listeners are wired before `connect()` so we don't
 * miss the very first `tool-result` that opened the iframe.
 */
export async function bootstrap<P>(name: string): Promise<AppHandle<P>> {
  const app = new App({ name, version: "0.2.0" });

  const subscribers: Array<(p: P) => void> = [];
  let resolveInitial!: (props: P) => void;
  let rejectInitial!: (err: unknown) => void;
  const initial = new Promise<P>((res, rej) => {
    resolveInitial = res;
    rejectInitial = rej;
  });
  let received = false;

  app.ontoolresult = (params) => {
    const meta = (params as { _meta?: Record<string, unknown> })._meta;
    const ui = meta?.[UI_META_KEY] as { props?: P } | undefined;
    const props = ui?.props;
    if (!props) return;
    if (!received) {
      received = true;
      resolveInitial(props);
    } else {
      for (const s of subscribers) s(props);
    }
  };

  // Surface tool errors so the iframe can render a friendly message.
  setTimeout(() => {
    if (!received) rejectInitial(new Error("No initial UI props received"));
  }, 10_000);

  await app.connect();
  const props = await initial;

  return {
    app,
    props,
    onUpdate(h) {
      subscribers.push(h);
    },
  };
}
