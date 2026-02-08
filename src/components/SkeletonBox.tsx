import React, { useRef, useEffect } from "react";
import { View, Animated, DimensionValue, StyleProp, ViewStyle } from "react-native";

type SkeletonBoxProps = {
  height: number;
  width: DimensionValue;
  radius?: number;
  color?: string;
  shimmer?: boolean;
  direction?: "horizontal" | "vertical";
  shimmerSpeed?: number; // duration in ms
  shimmerOpacity?: number;
  style?: StyleProp<ViewStyle>; // Added this to fix the TS error
};

const SkeletonBox = ({
  height,
  width,
  radius = 8,
  color = "#e1e4eb",
  shimmer = true,
  direction = "horizontal",
  shimmerSpeed = 1200,
  shimmerOpacity = 0.5,
  style, // Destructure style here
}: SkeletonBoxProps) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shimmer) {
      const anim = Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: shimmerSpeed,
          useNativeDriver: true,
        })
      );
      anim.start();
      return () => anim.stop();
    }
  }, [shimmer, shimmerSpeed, shimmerAnim]);

  // Determine the output range for the animation
  // If width is a string (e.g. '100%'), we fallback to a reasonable offset like 400
  const widthVal = typeof width === 'number' ? width : 400;

  const shimmerStyle = shimmer
    ? {
        position: "absolute" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radius,
        opacity: shimmerOpacity,
        backgroundColor: "#f5f6fa",
        transform:
          direction === "horizontal"
            ? [{ translateX: shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-widthVal, widthVal] }) }]
            : [{ translateY: shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-height, height] }) }],
      }
    : {};

  return (
    <View 
      style={[
        { height, width, borderRadius: radius, backgroundColor: color, marginBottom: 12, overflow: "hidden" },
        style // Apply the passed style prop here
      ]}
    >
      {shimmer && <Animated.View style={shimmerStyle} />}
    </View>
  );
};

export default SkeletonBox;