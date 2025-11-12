import { useTheme } from "@/hooks/theme";
import { View, Text, Image } from "react-native";
import { ThemedText } from "./ThemedText";

const getInitials = (fullName: string) => {
  const allNames = fullName.trim().split(" ");
  const initials = allNames.reduce((acc, curr, index) => {
    if (index === 0 || index === allNames.length - 1) {
      acc = `${acc}${curr.charAt(0).toUpperCase()}`;
    }
    return acc;
  }, "");
  return initials;
};

interface AvatarProps {
  name: string;
  size?: number;
  image?: string | null;
  backgroundColor?: string;
}

export const Avatar = ({
  name,
  size = 32,
  image,
  backgroundColor,
}: AvatarProps) => {
  const { colors } = useTheme();

  const initials = getInitials(name ?? "");

  let showInitials = true;
  if (image) {
    // Skip rendering initials in case of `avatar_url`
    // Unless from Gravatar since they offer a transparent image in case of no avatar
    // Also have to check for `http` first to avoid running `new URL` on internal NextJS asset paths
    const avatarHost = image.startsWith("http") ? new URL(image).host : null;
    showInitials = avatarHost === "www.gravatar.com";
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: backgroundColor ?? colors.monochrome,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {showInitials && (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: "center",
            justifyContent: "center",
            position: "absolute",
            inset: 0,
          }}
        >
          <ThemedText style={{ fontSize: size / 3 }}>{initials}</ThemedText>
        </View>
      )}
      {image && (
        <Image
          height={size}
          width={size}
          style={{
            borderRadius: size / 2,
            alignItems: "center",
            justifyContent: "center",
            position: "absolute",
            inset: 0,
            zIndex: 1,
          }}
          source={{ uri: image }}
        />
      )}
    </View>
  );
};
