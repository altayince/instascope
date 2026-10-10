import Link from "next/link";
import type { ComponentProps } from "react";

type ActionVariant = "primary" | "secondary" | "tertiary" | "danger";
type ActionStyle = { variant?: ActionVariant };
const actionClass = (variant: ActionVariant, className?: string) =>
  ["button", variant, className].filter(Boolean).join(" ");

export function ActionButton({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<"button"> & ActionStyle) {
  return <button className={actionClass(variant, className)} {...props} />;
}

export function ActionLink({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<typeof Link> & ActionStyle) {
  return <Link className={actionClass(variant, className)} {...props} />;
}

export function InsightLink({
  className,
  children,
  href,
  ...props
}: ComponentProps<typeof Link>) {
  const classes = ["insight-link", className].filter(Boolean).join(" ");
  const content = (
    <>
      {children}
      <span aria-hidden="true">›</span>
    </>
  );
  // Native fragment navigation also moves keyboard focus to the target heading.
  if (typeof href === "string" && href.startsWith("#"))
    return (
      <a className={classes} href={href} {...props}>
        {content}
      </a>
    );
  return (
    <Link className={classes} href={href} {...props}>
      {content}
    </Link>
  );
}
