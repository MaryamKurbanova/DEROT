type Props = {
  onSynced?: () => void;
  active?: boolean;
};

/** Non-iOS: no Screen Time report probe. */
export function ScreenTimeReportProbe(_props: Props) {
  return null;
}
