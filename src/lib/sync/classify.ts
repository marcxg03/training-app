type ResponseLike = {
  status: number;
};

type ErrorLike = {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
};

function hasNumericStatus(value: unknown): value is ResponseLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof (value as { status?: unknown }).status === "number"
  );
}

function getErrorLike(value: unknown): ErrorLike | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as ErrorLike;
}

export function isRetryable(errorOrResponse: unknown) {
  if (errorOrResponse instanceof Error) {
    return true;
  }

  if (hasNumericStatus(errorOrResponse)) {
    if (errorOrResponse.status === 408 || errorOrResponse.status === 429) {
      return true;
    }

    if (errorOrResponse.status >= 500 && errorOrResponse.status <= 599) {
      return true;
    }

    if (errorOrResponse.status >= 400 && errorOrResponse.status <= 499) {
      return false;
    }
  }

  const errorLike = getErrorLike(errorOrResponse);

  if (!errorLike) {
    return false;
  }

  if (errorLike.code === "23505") {
    return false;
  }

  if (typeof errorLike.status === "number") {
    return isRetryable({ status: errorLike.status });
  }

  const message = errorLike.message?.toLowerCase() ?? "";
  const name = errorLike.name?.toLowerCase() ?? "";

  if (
    name === "aborterror" ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("load failed")
  ) {
    return true;
  }

  return false;
}
