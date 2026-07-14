import { type Component, type JSX, splitProps } from "solid-js";

/**
 * Card primitive —— daisyui `card` 的薄封装。
 * class 透传，保证迁移时零视觉变化；reskin 时统一改这里。
 */
export interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export const Card: Component<CardProps> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return <div {...rest} class={["card pixel-border", local.class ?? ""].filter(Boolean).join(" ")} />;
};

export interface CardBodyProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export const CardBody: Component<CardBodyProps> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return <div {...rest} class={["card-body", local.class ?? ""].filter(Boolean).join(" ")} />;
};

export interface CardTitleProps extends JSX.HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export const CardTitle: Component<CardTitleProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "as"]);
  return <h3 {...rest} class={["card-title", local.class ?? ""].filter(Boolean).join(" ")} />;
};

export interface CardActionsProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export const CardActions: Component<CardActionsProps> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return <div {...rest} class={["card-actions", local.class ?? ""].filter(Boolean).join(" ")} />;
};

export default Card;
