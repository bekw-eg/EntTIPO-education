"use client";
import Link from "next/link";
import { type ComponentProps } from "react";
import { isRetiredPage } from "@/lib/publicFeatures";

/** Do not offer navigation to archived learning surfaces. */
export default function PublicLink(props: ComponentProps<typeof Link>) {
  const href = typeof props.href === "string" ? props.href : props.href.pathname ?? "";
  return isRetiredPage(href) ? null : <Link {...props} />;
}
