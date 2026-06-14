type Props = {
  enabled?: boolean;
  refreshToken?: number;
  inline?: boolean;
  visible?: boolean;
};

/** Non-iOS: no DeviceActivity report host. */
export function ScreenTimeReportHost(_props: Props) {
  return null;
}
