/**
 * Native intercept (or deep links) call `requestInterceptWall(appId)` so the ritual
 * sheet opens for that distraction. `appId` must match `DistractionApp.id` in
 * `distractionApps.ts` (e.g. `tiktok`, `instagram`).
 */
type WallHandler = (appId: string) => void;

let wallHandler: WallHandler | null = null;

export function registerInterceptWallHandler(handler: WallHandler | null): void {
  wallHandler = handler;
}

export function requestInterceptWall(appId: string): void {
  wallHandler?.(appId);
}
