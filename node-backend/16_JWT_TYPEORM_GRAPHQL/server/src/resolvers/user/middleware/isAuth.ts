import { ContextType } from "../../../types";
import { MiddlewareFn, NextFn } from "type-graphql";
import jwt from "jsonwebtoken";
export const isAuth: MiddlewareFn<ContextType> = (
  { context },
  next: NextFn
): Promise<any> => {
  const authorization = context.req.headers["authorization"];
  if (!authorization) {
    throw new Error("not authenticated");
  }
  try {
    const token = authorization.includes("Bearer")
      ? authorization.split(" ")[1]
      : authorization;
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRETE!);
    context.payload = payload as any;
  } catch (err) {
    console.log(err);
    throw new Error("not authenticated");
  }

  return next();
};
