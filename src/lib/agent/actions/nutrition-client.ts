"use client";

import type { Args } from "../tools/meta";
import type { ExecResult } from "./client";

/** Ejecutores de agua y comidas (Fase C). */
export const NUTRITION_EXECUTORS: Record<string, (args: Args) => ExecResult> = {};
