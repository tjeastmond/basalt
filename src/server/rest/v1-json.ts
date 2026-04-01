import { NextResponse } from "next/server";

export type V1ErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export function v1JsonError(status: number, code: string, message: string): NextResponse<V1ErrorBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function v1JsonOk<T>(status: number, body: T): NextResponse<T> {
  return NextResponse.json(body, { status });
}
