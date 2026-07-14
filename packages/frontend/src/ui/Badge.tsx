import { type Component, type JSX, splitProps } from "solid-js";

/** Badge primitive —— daisyui `badge` 一族的薄封装。 */
export type BadgeVariant = "neutral" | "info" | "success" | "warning" | "error" | "outline";

export type BadgeSize = "xs" | "sm" | "md" | "lg";

export interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  ghost?: boolean;
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  neutral: "",
  info: "badge-info",
  success: "badge-success",
  warning: "badge-warning",
  error: "badge-error",
  outline: "badge-outline",
};

const SIZE_CLASS: Record<BadgeSize, string> = {
  xs: "badge-xs",
  sm: "badge-sm",
  md: "",
  lg: "badge-lg",
};

export const Badge: Component<BadgeProps> = (props) => {
  const [local, rest] = splitProps(props, ["variant", "size", "ghost", "class"]);
  const cls = () =>
    [
      "badge pixel-border",
      VARIANT_CLASS[local.variant ?? "neutral"],
      SIZE_CLASS[local.size ?? "md"],
      local.ghost ? "badge-ghost" : "",
      local.class ?? "",
    ]
      .filter(Boolean)
      .join(" ");
  return <span {...rest} class={cls()} />;
};

export default Badge;
