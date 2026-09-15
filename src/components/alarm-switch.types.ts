export type AlarmSwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled: boolean;
  label: string;
  testID: string;
};
