import type { SerializedError } from "./types";

export function hostFromUrl(urlString: string): string | undefined {
  try {
    return new URL(urlString.trim()).hostname;
  } catch {
    return undefined;
  }
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "Error",
    message: typeof error === "string" ? error : "Unknown error",
  };
}
