import { ActionSheetIOS, Alert, Platform } from "react-native";

// The iPhone's own bottom sheet, dark. Anywhere else (the example build in
// a browser) the same choices are asked as a plain alert.
export type SheetOptions = {
  title?: string;
  message?: string;
  options: string[];
  cancelButtonIndex: number;
  destructiveButtonIndex?: number | number[];
};

export function sheet(o: SheetOptions, picked: (index: number) => void) {
  if (Platform.OS === "ios") {
    return ActionSheetIOS.showActionSheetWithOptions({ ...o, userInterfaceStyle: "dark" }, picked);
  }
  Alert.alert(
    o.title ?? "",
    o.message,
    o.options.map((text, i) => ({ text, style: i === o.cancelButtonIndex ? ("cancel" as const) : undefined, onPress: () => picked(i) }))
  );
}

// A sheet of named choices with Cancel last: each choice carries what it
// does, so a list can never be answered by the wrong index.
export type Choice = { label: string; run: () => void; destructive?: boolean };

export function choose(input: { title?: string; message?: string; choices: Choice[] }) {
  const { choices } = input;
  const destructive = choices.flatMap((c, i) => (c.destructive ? [i] : []));
  sheet(
    {
      title: input.title,
      message: input.message,
      options: [...choices.map((c) => c.label), "Cancel"],
      cancelButtonIndex: choices.length,
      destructiveButtonIndex: destructive.length ? destructive : undefined,
    },
    (i) => choices[i]?.run()
  );
}
