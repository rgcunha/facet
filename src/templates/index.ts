import type { ComponentType } from "react";
import type { TemplateId } from "@/lib/cv/schema";
import { Classic } from "./Classic";
import type { TemplateProps } from "./parts";
import { Modern } from "./Modern";
import { Sidebar } from "./Sidebar";

export const TEMPLATES: Record<TemplateId, ComponentType<TemplateProps>> = {
  classic: Classic,
  sidebar: Sidebar,
  modern: Modern,
};
