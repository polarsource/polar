import { useContext } from "react";
import { themes } from "@/utils/theme";
import { ThemeContext } from "@/providers/ThemeProvider";

export function useTheme() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const colors = themes[theme as keyof typeof themes];

  return {
    theme,
    toggleTheme,
    colors,
  };
}
